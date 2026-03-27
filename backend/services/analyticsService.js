/**
 * Analytics Service - Data Analysis & Insights
 * Provides waste analytics, predictions, and insights
 */

const { prisma } = require('../database/db');

class AnalyticsService {
    constructor() {
        this.cache = new Map();
        this.cacheTTL = 5 * 60 * 1000; // 5 minutes cache
    }

    // =============================================
    // Dashboard Analytics
    // =============================================

    async getDashboardAnalytics(startDate = null, endDate = null) {
        const cacheKey = `dashboard_${startDate}_${endDate}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) return cached;

        const analytics = {
            overview: await this.getOverviewStats(startDate, endDate),
            trends: await this.getTrends(startDate, endDate),
            wasteComposition: await this.getWasteComposition(startDate, endDate),
            performance: await this.getPerformanceMetrics(startDate, endDate),
            predictions: await this.getPredictions(),
            insights: await this.generateInsights()
        };

        this.setCache(cacheKey, analytics);
        return analytics;
    }

    async getOverviewStats(startDate, endDate) {
        const where = this.buildDateFilter(startDate, endDate);

        const [
            totalCollections,
            totalWaste,
            totalPoints,
            activeUsers,
            activeCollectors,
            recyclingRate
        ] = await Promise.all([
            prisma.collection.count({ where }),
            prisma.collection.aggregate({
                where,
                _sum: { wasteWeight: true }
            }),
            prisma.pointTransaction.aggregate({
                where: { ...where, points: { gt: 0 } },
                _sum: { points: true }
            }),
            prisma.user.count({
                where: {
                    ...where,
                    collections: { some: {} }
                }
            }),
            prisma.user.count({
                where: {
                    role: 'COLLECTOR',
                    collections: { some: where }
                }
            }),
            this.calculateRecyclingRate(where)
        ]);

        return {
            totalCollections,
            totalWaste: totalWaste._sum.wasteWeight || 0,
            totalPoints: totalPoints._sum.points || 0,
            activeUsers,
            activeCollectors,
            recyclingRate: recyclingRate.toFixed(1),
            averageWastePerCollection: totalCollections > 0 
                ? (totalWaste._sum.wasteWeight / totalCollections).toFixed(2) 
                : 0
        };
    }

    async getTrends(startDate, endDate) {
        const trends = {
            daily: [],
            weekly: [],
            monthly: []
        };

        // Daily trends
        const dailyData = await this.getDailyTrends(startDate, endDate);
        trends.daily = dailyData;

        // Weekly trends
        const weeklyData = await this.getWeeklyTrends(startDate, endDate);
        trends.weekly = weeklyData;

        // Monthly trends
        const monthlyData = await this.getMonthlyTrends(startDate, endDate);
        trends.monthly = monthlyData;

        // Calculate growth rates
        trends.growth = this.calculateGrowthRates(dailyData);

        return trends;
    }

    async getDailyTrends(startDate, endDate) {
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const trends = [];
        const currentDate = new Date(start);

        while (currentDate <= end) {
            const dayStart = new Date(currentDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(currentDate);
            dayEnd.setHours(23, 59, 59, 999);

            const collections = await prisma.collection.findMany({
                where: {
                    collectionTime: {
                        gte: dayStart,
                        lte: dayEnd
                    }
                },
                include: {
                    bin: true
                }
            });

            const totalWaste = collections.reduce((sum, c) => sum + (c.wasteWeight || 0), 0);
            const totalPoints = collections.reduce((sum, c) => sum + (c.pointsAwarded || 0), 0);
            const excellentCount = collections.filter(c => c.segregationQuality === 'EXCELLENT').length;

            trends.push({
                date: currentDate.toISOString().split('T')[0],
                dayOfWeek: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
                collections: collections.length,
                waste: totalWaste,
                points: totalPoints,
                quality: {
                    excellent: excellentCount,
                    good: collections.filter(c => c.segregationQuality === 'GOOD').length,
                    poor: collections.filter(c => c.segregationQuality === 'POOR').length,
                    failed: collections.filter(c => c.segregationQuality === 'FAILED').length
                },
                recyclingRate: totalWaste > 0 ? (collections.filter(c => c.bin?.binType === 'RECYCLABLE').reduce((sum, c) => sum + (c.wasteWeight || 0), 0) / totalWaste * 100) : 0
            });

            currentDate.setDate(currentDate.getDate() + 1);
        }

        return trends;
    }

    async getWeeklyTrends(startDate, endDate) {
        const dailyTrends = await this.getDailyTrends(startDate, endDate);
        const weeklyMap = new Map();

        for (const day of dailyTrends) {
            const date = new Date(day.date);
            const weekKey = this.getWeekKey(date);
            
            if (!weeklyMap.has(weekKey)) {
                weeklyMap.set(weekKey, {
                    week: weekKey,
                    startDate: this.getStartOfWeek(date),
                    endDate: this.getEndOfWeek(date),
                    collections: 0,
                    waste: 0,
                    points: 0,
                    days: []
                });
            }

            const week = weeklyMap.get(weekKey);
            week.collections += day.collections;
            week.waste += day.waste;
            week.points += day.points;
            week.days.push(day);
        }

        return Array.from(weeklyMap.values());
    }

    async getMonthlyTrends(startDate, endDate) {
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        const trends = [];
        const currentDate = new Date(start.getFullYear(), start.getMonth(), 1);

        while (currentDate <= end) {
            const monthStart = new Date(currentDate);
            const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

            const collections = await prisma.collection.findMany({
                where: {
                    collectionTime: {
                        gte: monthStart,
                        lte: monthEnd
                    }
                }
            });

            const totalWaste = collections.reduce((sum, c) => sum + (c.wasteWeight || 0), 0);
            const totalPoints = collections.reduce((sum, c) => sum + (c.pointsAwarded || 0), 0);

            trends.push({
                month: currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                collections: collections.length,
                waste: totalWaste,
                points: totalPoints,
                averagePerDay: collections.length / this.getDaysInMonth(currentDate)
            });

            currentDate.setMonth(currentDate.getMonth() + 1);
        }

        return trends;
    }

    async getWasteComposition(startDate, endDate) {
        const where = this.buildDateFilter(startDate, endDate);

        const collections = await prisma.collection.findMany({
            where,
            include: { bin: true }
        });

        const composition = {
            byType: {
                ORGANIC: { weight: 0, count: 0 },
                RECYCLABLE: { weight: 0, count: 0 },
                NON_RECYCLABLE: { weight: 0, count: 0 },
                HAZARDOUS: { weight: 0, count: 0 }
            },
            byQuality: {
                EXCELLENT: { count: 0, points: 0 },
                GOOD: { count: 0, points: 0 },
                POOR: { count: 0, points: 0 },
                FAILED: { count: 0, points: 0 }
            },
            byArea: {}
        };

        for (const collection of collections) {
            const binType = collection.bin?.binType;
            if (binType && composition.byType[binType]) {
                composition.byType[binType].weight += collection.wasteWeight || 0;
                composition.byType[binType].count++;
            }

            const quality = collection.segregationQuality;
            if (quality && composition.byQuality[quality]) {
                composition.byQuality[quality].count++;
                composition.byQuality[quality].points += collection.pointsAwarded || 0;
            }

            const area = collection.bin?.ward || 'Unknown';
            if (!composition.byArea[area]) {
                composition.byArea[area] = { weight: 0, count: 0, points: 0 };
            }
            composition.byArea[area].weight += collection.wasteWeight || 0;
            composition.byArea[area].count++;
            composition.byArea[area].points += collection.pointsAwarded || 0;
        }

        // Calculate percentages
        const totalWeight = Object.values(composition.byType).reduce((sum, t) => sum + t.weight, 0);
        for (const [type, data] of Object.entries(composition.byType)) {
            data.percentage = totalWeight > 0 ? (data.weight / totalWeight * 100).toFixed(1) : 0;
        }

        return composition;
    }

    async getPerformanceMetrics(startDate, endDate) {
        const where = this.buildDateFilter(startDate, endDate);

        const [
            collectors,
            households,
            bins
        ] = await Promise.all([
            prisma.user.findMany({
                where: { role: 'COLLECTOR' },
                include: {
                    collections: {
                        where,
                        include: { bin: true }
                    }
                }
            }),
            prisma.user.findMany({
                where: { role: 'HOUSEHOLD' },
                include: {
                    collections: {
                        where,
                        include: { bin: true }
                    }
                }
            }),
            prisma.qRBin.findMany({
                include: {
                    collections: {
                        where
                    }
                }
            })
        ]);

        // Collector performance
        const collectorPerformance = collectors.map(collector => ({
            id: collector.id,
            name: collector.name,
            totalCollections: collector.collections.length,
            totalWaste: collector.collections.reduce((sum, c) => sum + (c.wasteWeight || 0), 0),
            totalPoints: collector.collections.reduce((sum, c) => sum + (c.pointsAwarded || 0), 0),
            averageQuality: this.calculateAverageQuality(collector.collections),
            efficiency: this.calculateEfficiency(collector.collections)
        })).sort((a, b) => b.totalCollections - a.totalCollections);

        // Household performance
        const householdPerformance = households.map(household => ({
            id: household.id,
            name: household.name,
            totalCollections: household.collections.length,
            totalWaste: household.collections.reduce((sum, c) => sum + (c.wasteWeight || 0), 0),
            totalPoints: household.points,
            recyclingRate: this.calculateHouseholdRecyclingRate(household.collections),
            consistency: this.calculateConsistency(household.collections)
        })).sort((a, b) => b.totalPoints - a.totalPoints);

        // Bin performance
        const binPerformance = bins.map(bin => ({
            id: bin.id,
            qrCode: bin.qrCode,
            type: bin.binType,
            location: bin.locality,
            totalCollections: bin.collections.length,
            averageFillRate: bin.currentFill,
            fillFrequency: this.calculateFillFrequency(bin.collections),
            utilization: (bin.collections.length / 30) * 100 // Collections per month
        })).sort((a, b) => b.totalCollections - a.totalCollections);

        return {
            collectors: collectorPerformance.slice(0, 10),
            households: householdPerformance.slice(0, 10),
            bins: binPerformance.slice(0, 10),
            topCollector: collectorPerformance[0] || null,
            topHousehold: householdPerformance[0] || null,
            mostUsedBin: binPerformance[0] || null
        };
    }

    // =============================================
    // AI Predictions
    // =============================================

    async getPredictions() {
        const historicalData = await this.getHistoricalData();
        const predictions = {
            daily: await this.predictDailyWaste(historicalData),
            weekly: await this.predictWeeklyWaste(historicalData),
            monthly: await this.predictMonthlyWaste(historicalData),
            festival: await this.predictFestivalImpact(),
            seasonal: await this.predictSeasonalTrends()
        };

        return predictions;
    }

    async predictDailyWaste(historicalData) {
        const last30Days = historicalData.slice(-30);
        const average = last30Days.reduce((sum, d) => sum + d.waste, 0) / 30;
        const trend = this.calculateTrend(last30Days);

        const predictions = [];
        for (let i = 1; i <= 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            let predicted = average * (1 + trend);
            if (isWeekend) predicted *= 1.3;
            if (this.isHoliday(date)) predicted *= 1.5;

            predictions.push({
                date: date.toISOString().split('T')[0],
                dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
                predictedWaste: Math.round(predicted),
                confidence: this.calculateConfidence(historicalData),
                factors: {
                    isWeekend,
                    isHoliday: this.isHoliday(date),
                    trend: trend > 0 ? 'increasing' : 'decreasing'
                }
            });
        }

        return predictions;
    }

    async predictWeeklyWaste(historicalData) {
        const weeklyData = [];
        for (let i = 0; i < historicalData.length; i += 7) {
            const week = historicalData.slice(i, i + 7);
            if (week.length === 7) {
                weeklyData.push({
                    weekStart: week[0].date,
                    totalWaste: week.reduce((sum, d) => sum + d.waste, 0),
                    average: week.reduce((sum, d) => sum + d.waste, 0) / 7
                });
            }
        }

        const trend = this.calculateTrend(weeklyData.map(w => w.totalWaste));
        const lastAverage = weeklyData[weeklyData.length - 1]?.average || 0;

        const predictions = [];
        for (let i = 1; i <= 4; i++) {
            const predicted = lastAverage * Math.pow(1 + trend, i) * 7;
            predictions.push({
                week: i,
                predictedWaste: Math.round(predicted),
                confidence: 0.7 + (trend * 0.2),
                recommendation: this.getWeeklyRecommendation(predicted)
            });
        }

        return predictions;
    }

    async predictMonthlyWaste(historicalData) {
        const monthlyData = await this.getMonthlyTrends();
        const lastYearData = monthlyData.slice(-12);
        
        const seasonalIndex = this.calculateSeasonalIndex(lastYearData);
        const yearlyGrowth = this.calculateYearlyGrowth(lastYearData);

        const predictions = [];
        for (let i = 1; i <= 12; i++) {
            const monthIndex = (new Date().getMonth() + i) % 12;
            const predicted = lastYearData[lastYearData.length - 1].waste * (1 + yearlyGrowth) * seasonalIndex[monthIndex];
            
            predictions.push({
                month: new Date(new Date().getFullYear(), (new Date().getMonth() + i) % 12).toLocaleDateString('en-US', { month: 'long' }),
                predictedWaste: Math.round(predicted),
                seasonalFactor: seasonalIndex[monthIndex],
                confidence: 0.8
            });
        }

        return predictions;
    }

    async predictFestivalImpact() {
        const festivals = [
            { name: 'Diwali', date: '2024-10-31', multiplier: 2.5, wasteType: 'HAZARDOUS' },
            { name: 'Christmas', date: '2024-12-25', multiplier: 1.8, wasteType: 'RECYCLABLE' },
            { name: 'New Year', date: '2025-01-01', multiplier: 2.0, wasteType: 'RECYCLABLE' },
            { name: 'Ganesh Chaturthi', date: '2024-09-07', multiplier: 2.2, wasteType: 'ORGANIC' },
            { name: 'Eid', date: '2024-06-17', multiplier: 1.9, wasteType: 'ORGANIC' },
            { name: 'Holi', date: '2025-03-14', multiplier: 2.3, wasteType: 'HAZARDOUS' }
        ];

        const predictions = [];
        const historicalBase = await this.getBaseWasteLevel();

        for (const festival of festivals) {
            const date = new Date(festival.date);
            const predictedIncrease = historicalBase * (festival.multiplier - 1);
            
            predictions.push({
                festival: festival.name,
                date: festival.date,
                predictedIncrease: Math.round(predictedIncrease),
                totalPredicted: Math.round(historicalBase * festival.multiplier),
                wasteType: festival.wasteType,
                recommendations: this.getFestivalRecommendations(festival.name),
                requiredResources: {
                    additionalTrucks: Math.ceil(predictedIncrease / 500),
                    additionalCollectors: Math.ceil(predictedIncrease / 300),
                    temporaryBins: Math.ceil(predictedIncrease / 200)
                }
            });
        }

        return predictions;
    }

    async predictSeasonalTrends() {
        const historicalData = await this.getHistoricalData();
        const seasons = ['Winter', 'Spring', 'Summer', 'Monsoon', 'Autumn'];
        
        const seasonalData = {};
        for (const season of seasons) {
            seasonalData[season] = {
                waste: [],
                points: [],
                collections: []
            };
        }

        for (const data of historicalData) {
            const season = this.getSeason(new Date(data.date));
            seasonalData[season].waste.push(data.waste);
            seasonalData[season].collections.push(data.collections);
            seasonalData[season].points.push(data.points);
        }

        const predictions = [];
        for (const [season, data] of Object.entries(seasonalData)) {
            if (data.waste.length > 0) {
                predictions.push({
                    season: season,
                    averageWaste: data.waste.reduce((a, b) => a + b, 0) / data.waste.length,
                    averageCollections: data.collections.reduce((a, b) => a + b, 0) / data.collections.length,
                    averagePoints: data.points.reduce((a, b) => a + b, 0) / data.points.length,
                    trend: this.calculateTrend(data.waste),
                    recommendations: this.getSeasonalRecommendations(season)
                });
            }
        }

        return predictions;
    }

    // =============================================
    // Insights Generation
    // =============================================

    async generateInsights() {
        const insights = {
            efficiency: await this.getEfficiencyInsights(),
            waste: await this.getWasteInsights(),
            community: await this.getCommunityInsights(),
            environmental: await this.getEnvironmentalInsights(),
            recommendations: []
        };

        // Generate actionable recommendations
        insights.recommendations = this.generateRecommendations(insights);
        
        return insights;
    }

    async getEfficiencyInsights() {
        const collections = await prisma.collection.findMany({
            include: { collector: true }
        });

        const avgCollectionTime = this.calculateAverageCollectionTime(collections);
        const peakHours = this.getPeakHours(collections);
        const collectorEfficiency = await this.getCollectorEfficiency();

        return {
            averageCollectionTime: avgCollectionTime,
            peakHours: peakHours,
            collectorEfficiency: collectorEfficiency,
            bottlenecks: this.identifyBottlenecks(collections),
            suggestions: this.getEfficiencySuggestions(collectorEfficiency, peakHours)
        };
    }

    async getWasteInsights() {
        const wasteComposition = await this.getWasteComposition();
        const trends = await this.getTrends();
        
        const insights = {
            composition: wasteComposition,
            recyclingPotential: this.calculateRecyclingPotential(wasteComposition),
            contaminationRate: this.calculateContaminationRate(wasteComposition),
            topWasteCategories: this.getTopWasteCategories(wasteComposition),
            reductionOpportunities: this.getReductionOpportunities(wasteComposition)
        };

        return insights;
    }

    async getCommunityInsights() {
        const households = await prisma.user.findMany({
            where: { role: 'HOUSEHOLD' },
            include: { collections: true, pointsHistory: true }
        });

        const wards = await prisma.ward.findMany({
            include: { users: true }
        });

        return {
            totalHouseholds: households.length,
            activeHouseholds: households.filter(h => h.collections.length > 0).length,
            averagePointsPerHousehold: households.reduce((sum, h) => sum + h.points, 0) / households.length,
            topPerformingWards: wards.sort((a, b) => b.totalPoints - a.totalPoints).slice(0, 5),
            engagementRate: (households.filter(h => h.collections.length > 5).length / households.length) * 100,
            communityRankings: this.getCommunityRankings(wards)
        };
    }

    async getEnvironmentalInsights() {
        const collections = await prisma.collection.findMany();
        const totalWaste = collections.reduce((sum, c) => sum + (c.wasteWeight || 0), 0);
        
        const carbonSaved = this.calculateCarbonSaved(totalWaste);
        const landfillAvoided = this.calculateLandfillAvoided(totalWaste);
        const energySaved = this.calculateEnergySaved(totalWaste);
        const treesSaved = this.calculateTreesSaved(carbonSaved);

        return {
            carbonSaved: carbonSaved,
            landfillAvoided: landfillAvoided,
            energySaved: energySaved,
            treesSaved: treesSaved,
            equivalentTo: {
                carsRemoved: Math.round(carbonSaved / 4.6),
                homesPowered: Math.round(energySaved / 3000),
                waterSaved: Math.round(landfillAvoided * 100)
            },
            impact: {
                monthly: await this.getMonthlyImpact(),
                yearly: await this.getYearlyImpact()
            }
        };
    }

    // =============================================
    // Helper Methods
    // =============================================

    async getHistoricalData(days = 365) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const collections = await prisma.collection.findMany({
            where: {
                collectionTime: { gte: startDate }
            },
            orderBy: { collectionTime: 'asc' }
        });

        const dailyData = new Map();
        
        for (const collection of collections) {
            const date = collection.collectionTime.toISOString().split('T')[0];
            if (!dailyData.has(date)) {
                dailyData.set(date, {
                    date: date,
                    waste: 0,
                    collections: 0,
                    points: 0
                });
            }
            
            const day = dailyData.get(date);
            day.waste += collection.wasteWeight || 0;
            day.collections++;
            day.points += collection.pointsAwarded || 0;
        }

        return Array.from(dailyData.values());
    }

    async getBaseWasteLevel() {
        const lastMonth = await prisma.collection.findMany({
            where: {
                collectionTime: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            }
        });
        
        const totalWaste = lastMonth.reduce((sum, c) => sum + (c.wasteWeight || 0), 0);
        return totalWaste / 30; // Daily average
    }

    buildDateFilter(startDate, endDate) {
        const filter = {};
        if (startDate || endDate) {
            filter.collectionTime = {};
            if (startDate) filter.collectionTime.gte = new Date(startDate);
            if (endDate) filter.collectionTime.lte = new Date(endDate);
        }
        return filter;
    }

    calculateRecyclingRate(where) {
        // Implementation for recycling rate calculation
        return 35.5; // Placeholder
    }

    calculateGrowthRates(data) {
        if (data.length < 2) return { daily: 0, weekly: 0, monthly: 0 };
        
        const recent = data.slice(-7).reduce((sum, d) => sum + d.waste, 0);
        const previous = data.slice(-14, -7).reduce((sum, d) => sum + d.waste, 0);
        
        return {
            daily: previous > 0 ? ((recent - previous) / previous) * 100 : 0,
            weekly: this.calculateWeeklyGrowth(data),
            monthly: this.calculateMonthlyGrowth(data)
        };
    }

    calculateWeeklyGrowth(data) {
        if (data.length < 14) return 0;
        const lastWeek = data.slice(-7).reduce((sum, d) => sum + d.waste, 0);
        const prevWeek = data.slice(-14, -7).reduce((sum, d) => sum + d.waste, 0);
        return prevWeek > 0 ? ((lastWeek - prevWeek) / prevWeek) * 100 : 0;
    }

    calculateMonthlyGrowth(data) {
        if (data.length < 60) return 0;
        const lastMonth = data.slice(-30).reduce((sum, d) => sum + d.waste, 0);
        const prevMonth = data.slice(-60, -30).reduce((sum, d) => sum + d.waste, 0);
        return prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;
    }

    calculateTrend(data) {
        if (data.length < 2) return 0;
        const n = data.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = data;
        
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
        const sumX2 = x.reduce((a, b) => a + b * b, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        return slope / (sumY / n); // Normalized trend
    }

    calculateConfidence(data) {
        if (data.length < 30) return 0.5;
        const variance = this.calculateVariance(data);
        const maxVariance = 10000; // Assumed max variance
        return Math.max(0.5, 1 - (variance / maxVariance));
    }

    calculateVariance(data) {
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        const squaredDiffs = data.map(value => Math.pow(value - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / data.length;
    }

    calculateSeasonalIndex(monthlyData) {
        const indices = new Array(12).fill(0);
        const counts = new Array(12).fill(0);
        
        for (const data of monthlyData) {
            const month = new Date(data.date).getMonth();
            indices[month] += data.waste;
            counts[month]++;
        }
        
        const average = indices.reduce((a, b) => a + b, 0) / 12;
        
        for (let i = 0; i < 12; i++) {
            if (counts[i] > 0) {
                indices[i] = (indices[i] / counts[i]) / average;
            } else {
                indices[i] = 1;
            }
        }
        
        return indices;
    }

    calculateYearlyGrowth(data) {
        if (data.length < 2) return 0;
        const firstHalf = data.slice(0, Math.floor(data.length / 2));
        const secondHalf = data.slice(Math.floor(data.length / 2));
        
        const firstAvg = firstHalf.reduce((a, b) => a + b.waste, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b.waste, 0) / secondHalf.length;
        
        return (secondAvg - firstAvg) / firstAvg;
    }

    calculateAverageQuality(collections) {
        if (collections.length === 0) return 0;
        const qualityScores = {
            EXCELLENT: 100,
            GOOD: 75,
            POOR: 40,
            FAILED: 10
        };
        
        const totalScore = collections.reduce((sum, c) => sum + (qualityScores[c.segregationQuality] || 0), 0);
        return totalScore / collections.length;
    }

    calculateEfficiency(collections) {
        if (collections.length === 0) return 0;
        const avgTimePerCollection = 5; // minutes
        const targetPerDay = 20;
        const efficiency = (collections.length / targetPerDay) * 100;
        return Math.min(100, efficiency);
    }

    calculateHouseholdRecyclingRate(collections) {
        if (collections.length === 0) return 0;
        const recyclableWaste = collections
            .filter(c => c.bin?.binType === 'RECYCLABLE')
            .reduce((sum, c) => sum + (c.wasteWeight || 0), 0);
        const totalWaste = collections.reduce((sum, c) => sum + (c.wasteWeight || 0), 0);
        return totalWaste > 0 ? (recyclableWaste / totalWaste) * 100 : 0;
    }

    calculateConsistency(collections) {
        if (collections.length === 0) return 0;
        const last30Days = collections.filter(c => {
            const daysDiff = (Date.now() - new Date(c.collectionTime)) / (1000 * 60 * 60 * 24);
            return daysDiff <= 30;
        });
        return (last30Days.length / 30) * 100;
    }

    calculateFillFrequency(collections) {
        if (collections.length === 0) return 0;
        const firstCollection = new Date(collections[0].collectionTime);
        const lastCollection = new Date(collections[collections.length - 1].collectionTime);
        const daysDiff = (lastCollection - firstCollection) / (1000 * 60 * 60 * 24);
        return daysDiff > 0 ? collections.length / daysDiff : 0;
    }

    calculateAverageCollectionTime(collections) {
        // Simplified - would need real timestamps
        return 5; // minutes
    }

    getPeakHours(collections) {
        const hourlyData = new Array(24).fill(0);
        for (const collection of collections) {
            const hour = new Date(collection.collectionTime).getHours();
            hourlyData[hour]++;
        }
        
        const peakHours = [];
        for (let i = 0; i < 24; i++) {
            if (hourlyData[i] > 10) {
                peakHours.push(i);
            }
        }
        
        return peakHours;
    }

    async getCollectorEfficiency() {
        const collectors = await prisma.user.findMany({
            where: { role: 'COLLECTOR' },
            include: { collections: true }
        });
        
        return collectors.map(c => ({
            name: c.name,
            totalCollections: c.collections.length,
            averagePerDay: c.collections.length / 30,
            efficiency: (c.collections.length / 20) * 100
        }));
    }

    identifyBottlenecks(collections) {
        const bottlenecks = [];
        const dailyCounts = new Map();
        
        for (const collection of collections) {
            const date = collection.collectionTime.toISOString().split('T')[0];
            dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
        }
        
        const average = Array.from(dailyCounts.values()).reduce((a, b) => a + b, 0) / dailyCounts.size;
        
        for (const [date, count] of dailyCounts) {
            if (count > average * 1.5) {
                bottlenecks.push({
                    date: date,
                    collections: count,
                    reason: 'High volume day'
                });
            }
        }
        
        return bottlenecks;
    }

    getEfficiencySuggestions(efficiency, peakHours) {
        const suggestions = [];
        
        if (efficiency < 70) {
            suggestions.push({
                type: 'collector',
                message: 'Increase collector training and optimize routes',
                priority: 'high'
            });
        }
        
        if (peakHours.length === 0) {
            suggestions.push({
                type: 'scheduling',
                message: 'Consider staggering collection times to reduce bottlenecks',
                priority: 'medium'
            });
        }
        
        return suggestions;
    }

    calculateRecyclingPotential(composition) {
        const recyclableTypes = ['RECYCLABLE', 'ORGANIC'];
        let recyclableWeight = 0;
        let totalWeight = 0;
        
        for (const [type, data] of Object.entries(composition.byType)) {
            if (recyclableTypes.includes(type)) {
                recyclableWeight += data.weight;
            }
            totalWeight += data.weight;
        }
        
        return totalWeight > 0 ? (recyclableWeight / totalWeight) * 100 : 0;
    }

    calculateContaminationRate(composition) {
        const nonRecyclable = composition.byType.NON_RECYCLABLE?.weight || 0;
        const total = Object.values(composition.byType).reduce((sum, t) => sum + t.weight, 0);
        return total > 0 ? (nonRecyclable / total) * 100 : 0;
    }

    getTopWasteCategories(composition) {
        return Object.entries(composition.byType)
            .sort((a, b) => b[1].weight - a[1].weight)
            .map(([type, data]) => ({
                type: type,
                weight: data.weight,
                percentage: data.percentage
            }));
    }

    getReductionOpportunities(composition) {
        const opportunities = [];
        const nonRecyclable = composition.byType.NON_RECYCLABLE?.weight || 0;
        
        if (nonRecyclable > 1000) {
            opportunities.push({
                category: 'Non-Recyclable',
                message: 'Implement awareness campaign to reduce single-use plastics',
                potentialSavings: nonRecyclable * 0.3
            });
        }
        
        return opportunities;
    }

    getCommunityRankings(wards) {
        return wards
            .map(w => ({
                name: w.name,
                points: w.totalPoints,
                participation: w.participationRate,
                rank: 0
            }))
            .sort((a, b) => b.points - a.points)
            .map((ward, index) => ({ ...ward, rank: index + 1 }));
    }

    calculateCarbonSaved(wasteKg) {
        // 0.5 kg CO2 per kg of waste recycled
        return wasteKg * 0.5;
    }

    calculateLandfillAvoided(wasteKg) {
        // 80% of waste diverted from landfill
        return wasteKg * 0.8;
    }

    calculateEnergySaved(wasteKg) {
        // 500 kWh per ton of waste recycled
        return wasteKg * 0.5;
    }

    calculateTreesSaved(carbonKg) {
        // 1 tree absorbs 22 kg CO2 per year
        return carbonKg / 22;
    }

    async getMonthlyImpact() {
        const lastMonth = await prisma.collection.findMany({
            where: {
                collectionTime: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                }
            }
        });
        
        const totalWaste = lastMonth.reduce((sum, c) => sum + (c.wasteWeight || 0), 0);
        
        return {
            wasteRecycled: totalWaste * 0.35,
            carbonSaved: this.calculateCarbonSaved(totalWaste),
            treesEquivalent: Math.round(this.calculateTreesSaved(this.calculateCarbonSaved(totalWaste))),
            householdsEngaged: new Set(lastMonth.map(c => c.householdId)).size
        };
    }

    async getYearlyImpact() {
        const lastYear = await prisma.collection.findMany({
            where: {
                collectionTime: {
                    gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
                }
            }
        });
        
        const totalWaste = lastYear.reduce((sum, c) => sum + (c.wasteWeight || 0), 0);
        
        return {
            totalWaste: totalWaste,
            recyclingRate: 35,
            carbonOffset: this.calculateCarbonSaved(totalWaste),
            landfillSavings: this.calculateLandfillAvoided(totalWaste),
            communityGrowth: 25 // Percentage
        };
    }

    getSeason(date) {
        const month = date.getMonth();
        if (month >= 2 && month <= 4) return 'Spring';
        if (month >= 5 && month <= 7) return 'Summer';
        if (month >= 8 && month <= 9) return 'Monsoon';
        if (month >= 10 && month <= 11) return 'Autumn';
        return 'Winter';
    }

    isHoliday(date) {
        const holidays = [
            '01-01', // New Year
            '01-26', // Republic Day
            '08-15', // Independence Day
            '10-02', // Gandhi Jayanti
            '12-25'  // Christmas
        ];
        const dateStr = `${date.getMonth() + 1}-${date.getDate()}`;
        return holidays.includes(dateStr);
    }

    getWeekKey(date) {
        const year = date.getFullYear();
        const weekNumber = Math.ceil((date - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
        return `${year}-W${weekNumber}`;
    }

    getStartOfWeek(date) {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(date.setDate(diff));
    }

    getEndOfWeek(date) {
        const start = this.getStartOfWeek(date);
        return new Date(start.setDate(start.getDate() + 6));
    }

    getDaysInMonth(date) {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    }

    getWeeklyRecommendation(predictedWaste) {
        if (predictedWaste > 5000) {
            return 'High waste predicted. Increase collection frequency.';
        } else if (predictedWaste > 3000) {
            return 'Moderate waste predicted. Regular collection sufficient.';
        }
        return 'Low waste predicted. Consider reducing collection frequency.';
    }

    getFestivalRecommendations(festival) {
        const recommendations = {
            Diwali: 'Deploy extra teams for hazardous waste collection. Set up temporary collection points.',
            Christmas: 'Increase recycling capacity for packaging waste. Add evening collection shifts.',
            'New Year': 'Prepare for increased glass and bottle waste. Set up dedicated collection points.',
            'Ganesh Chaturthi': 'Create specific collection points for idols. Deploy water body cleanup teams.',
            Holi: 'Provide specialized containers for colored powders. Increase water conservation measures.'
        };
        
        return recommendations[festival] || 'Monitor waste levels closely. Deploy additional resources as needed.';
    }

    getSeasonalRecommendations(season) {
        const recommendations = {
            Summer: 'Increase water availability for cleaning. Schedule early morning collections.',
            Monsoon: 'Use covered containers. Plan alternate routes for flooded areas.',
            Winter: 'Adjust collection timings for daylight. Prepare for increased organic waste.',
            Spring: 'Increase composting capacity. Launch awareness campaigns.'
        };
        
        return recommendations[season] || 'Maintain regular collection schedule.';
    }

    generateRecommendations(insights) {
        const recommendations = [];
        
        if (insights.efficiency.collectorEfficiency < 70) {
            recommendations.push({
                category: 'Efficiency',
                title: 'Improve Collector Efficiency',
                description: 'Collector efficiency is below target. Consider route optimization and additional training.',
                priority: 'high',
                action: 'Optimize routes and provide performance incentives'
            });
        }
        
        if (insights.waste.contaminationRate > 20) {
            recommendations.push({
                category: 'Quality',
                title: 'Reduce Contamination',
                description: 'High contamination rate detected. Launch awareness campaign about proper segregation.',
                priority: 'high',
                action: 'Conduct community workshops and send educational materials'
            });
        }
        
        if (insights.community.engagementRate < 50) {
            recommendations.push({
                category: 'Engagement',
                title: 'Increase Community Participation',
                description: 'Low community engagement. Introduce more rewards and gamification.',
                priority: 'medium',
                action: 'Launch referral program and bonus point system'
            });
        }
        
        return recommendations;
    }

    // =============================================
    // Cache Management
    // =============================================

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }
}

module.exports = AnalyticsService;