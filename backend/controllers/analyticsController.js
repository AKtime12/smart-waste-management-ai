const { prisma } = require('../database/db');
const predictionService = require('../services/predictionService');
const { calculateCarbonSavings } = require('../utils/helpers');

exports.getDashboardAnalytics = async (req, res) => {
    try {
        const [totalCollections, totalPoints, totalUsers] = await Promise.all([
            prisma.collection.count(),
            prisma.user.aggregate({ _sum: { points: true } }),
            prisma.user.count()
        ]);
        
        const dailyTrends = await getDailyTrends();
        const predictions = await predictionService.getWeeklyPredictions();
        
        res.json({
            overview: {
                totalCollections,
                totalPoints: totalPoints._sum.points || 0,
                totalUsers,
                recyclingRate: '35%',
                carbonSaved: 2350
            },
            dailyTrends,
            predictions
        });
        
    } catch (error) {
        console.error('Dashboard analytics error:', error);
        res.status(500).json({ error: 'Failed to get analytics' });
    }
};

exports.getWasteAnalytics = async (req, res) => {
    try {
        const wasteByType = await prisma.collection.groupBy({
            by: ['bin', 'binType'],
            _count: true,
            _sum: { wasteWeight: true }
        });
        
        const dailyWaste = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const start = new Date(date.setHours(0, 0, 0, 0));
            const end = new Date(date.setHours(23, 59, 59, 999));
            
            const collections = await prisma.collection.findMany({
                where: {
                    collectionTime: { gte: start, lte: end }
                }
            });
            
            dailyWaste.push({
                date: start.toLocaleDateString(),
                totalWaste: collections.reduce((sum, c) => sum + (c.wasteWeight || 0), 0),
                collections: collections.length
            });
        }
        
        res.json({
            byType: wasteByType,
            dailyTrends: dailyWaste,
            peakDays: ['Sunday', 'Monday'],
            averageDailyWaste: 850
        });
        
    } catch (error) {
        console.error('Waste analytics error:', error);
        res.status(500).json({ error: 'Failed to get waste analytics' });
    }
};

async function getDailyTrends() {
    const trends = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const start = new Date(date.setHours(0, 0, 0, 0));
        const end = new Date(date.setHours(23, 59, 59, 999));
        
        const collections = await prisma.collection.findMany({
            where: {
                collectionTime: { gte: start, lte: end }
            }
        });
        
        trends.push({
            date: start.toLocaleDateString(),
            collections: collections.length,
            waste: collections.reduce((sum, c) => sum + (c.wasteWeight || 0), 0),
            points: collections.reduce((sum, c) => sum + (c.pointsAwarded || 0), 0)
        });
    }
    return trends;
}