// backend/services/predictionService.js
const festivals = {
    'Diwali': { date: '2024-10-31', multiplier: 2.5, wasteType: 'hazardous' },
    'Christmas': { date: '2024-12-25', multiplier: 1.8, wasteType: 'recyclable' },
    'New Year': { date: '2025-01-01', multiplier: 2.0, wasteType: 'recyclable' },
    'Ganesh Chaturthi': { date: '2024-09-07', multiplier: 2.2, wasteType: 'organic' },
    'Eid': { date: '2024-06-17', multiplier: 1.9, wasteType: 'organic' },
    'Holi': { date: '2025-03-14', multiplier: 2.3, wasteType: 'hazardous' },
    'Ramadan': { date: '2024-03-10', multiplier: 1.5, wasteType: 'organic' },
    'Pongal': { date: '2025-01-14', multiplier: 1.7, wasteType: 'organic' },
    'Durga Puja': { date: '2024-10-09', multiplier: 2.1, wasteType: 'organic' },
    'Independence Day': { date: '2024-08-15', multiplier: 1.6, wasteType: 'recyclable' }
};

class PredictionService {
    async predictWasteVolume(area, date) {
        // Get historical data
        const historical = await this.getHistoricalData(area);
        
        // Calculate base prediction using time series
        let basePrediction = this.timeSeriesPrediction(historical, date);
        
        // Apply festival multiplier
        const festivalMultiplier = this.getFestivalMultiplier(date);
        basePrediction *= festivalMultiplier;
        
        // Apply seasonal factor
        const seasonalFactor = this.getSeasonalFactor(date.getMonth());
        basePrediction *= seasonalFactor;
        
        // Apply day of week factor
        const dayFactor = this.getDayOfWeekFactor(date.getDay());
        basePrediction *= dayFactor;
        
        // Apply weather factor if available
        const weatherFactor = await this.getWeatherFactor(area, date);
        basePrediction *= weatherFactor;
        
        // Generate recommendations
        const recommendations = this.generateRecommendations(basePrediction, area);
        
        return {
            area: area,
            date: date.toISOString(),
            predictedVolume: Math.ceil(basePrediction),
            confidence: 0.85,
            factors: {
                festival: festivalMultiplier > 1 ? this.getFestivalName(date) : null,
                seasonal: seasonalFactor,
                dayOfWeek: date.getDay(),
                weather: weatherFactor
            },
            requiredTrucks: Math.ceil(basePrediction / 500), // 500kg per truck
            recommendations: recommendations,
            additionalResources: this.getResourceRequirements(basePrediction)
        };
    }

    getFestivalMultiplier(date) {
        const dateStr = date.toISOString().split('T')[0];
        for (let [festival, data] of Object.entries(festivals)) {
            // Check festival date and +/- 3 days around it
            const festivalDate = new Date(data.date);
            const diffDays = Math.abs(festivalDate - date) / (1000 * 60 * 60 * 24);
            if (diffDays <= 3) {
                return data.multiplier;
            }
        }
        return 1.0;
    }

    getFestivalName(date) {
        const dateStr = date.toISOString().split('T')[0];
        for (let [festival, data] of Object.entries(festivals)) {
            if (data.date === dateStr) return festival;
        }
        return null;
    }

    getSeasonalFactor(month) {
        // Summer (March-June): more organic waste
        if (month >= 2 && month <= 5) return 1.2;
        // Monsoon (July-September): less collection
        if (month >= 6 && month <= 8) return 0.9;
        // Winter (October-February): moderate
        return 1.1;
    }

    getDayOfWeekFactor(day) {
        // Weekend = more waste
        if (day === 0 || day === 6) return 1.3;
        // Monday = more waste from weekend
        if (day === 1) return 1.2;
        return 1.0;
    }

    async getWeatherFactor(area, date) {
        try {
            // Call weather API if available
            // For now, return default
            return 1.0;
        } catch (error) {
            return 1.0;
        }
    }

    generateRecommendations(predictedVolume, area) {
        const recommendations = [];
        
        if (predictedVolume > 1000) {
            recommendations.push({
                type: 'trucks',
                message: `🚛 Increase trucks by ${Math.ceil(predictedVolume / 500)} in ${area}`,
                priority: 'high'
            });
        }
        
        if (predictedVolume > 800) {
            recommendations.push({
                type: 'collectors',
                message: `👥 Deploy additional 3 collectors in ${area}`,
                priority: 'medium'
            });
        }
        
        if (predictedVolume > 500) {
            recommendations.push({
                type: 'bins',
                message: `🗑️ Add temporary bins in ${area}`,
                priority: 'medium'
            });
        }
        
        // Add special festival recommendations
        const festival = this.getFestivalName(new Date());
        if (festival) {
            recommendations.push({
                type: 'festival',
                message: `🎉 ${festival} special: Increase collection frequency to 3x daily`,
                priority: 'high'
            });
        }
        
        return recommendations;
    }

    getResourceRequirements(predictedVolume) {
        return {
            trucks: Math.ceil(predictedVolume / 500),
            collectors: Math.ceil(predictedVolume / 300),
            temporaryBins: Math.ceil(predictedVolume / 200),
            estimatedCost: predictedVolume * 0.5, // $0.5 per kg
            carbonImpact: predictedVolume * 0.1 // 0.1kg CO2 per kg waste
        };
    }

    timeSeriesPrediction(historical, date) {
        // Simple moving average with trend
        const volumes = historical.map(h => h.volume);
        const avg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
        
        // Calculate trend
        const recent = volumes.slice(-7);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const trend = (recentAvg - avg) / avg;
        
        return avg * (1 + trend);
    }
}

module.exports = PredictionService;