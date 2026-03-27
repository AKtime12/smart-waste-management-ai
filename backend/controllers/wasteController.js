const { prisma } = require('../database/db');

// Get collections for logged-in user
exports.getCollections = async (req, res) => {
    try {
        // Since we don't have Collection model yet, return demo data
        const demoCollections = [
            {
                id: '1',
                collectionTime: new Date().toISOString(),
                wasteWeight: 5.2,
                segregationQuality: 'EXCELLENT',
                pointsAwarded: 15
            },
            {
                id: '2',
                collectionTime: new Date(Date.now() - 86400000).toISOString(),
                wasteWeight: 3.5,
                segregationQuality: 'GOOD',
                pointsAwarded: 10
            },
            {
                id: '3',
                collectionTime: new Date(Date.now() - 172800000).toISOString(),
                wasteWeight: 4.8,
                segregationQuality: 'EXCELLENT',
                pointsAwarded: 15
            }
        ];
        
        res.json({
            collections: demoCollections,
            stats: {
                totalCollections: demoCollections.length,
                totalPoints: demoCollections.reduce((sum, c) => sum + c.pointsAwarded, 0),
                totalWeight: demoCollections.reduce((sum, c) => sum + c.wasteWeight, 0)
            }
        });
        
    } catch (error) {
        console.error('Get collections error:', error);
        res.status(500).json({ error: 'Failed to get collections' });
    }
};

// Get user stats
exports.getUserStats = async (req, res) => {
    try {
        const user = req.user;
        
        res.json({
            weekPoints: 85,
            monthPoints: 320,
            totalPoints: user.points,
            collections: 12,
            carbonSaved: 45
        });
        
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
};

// Get tips
exports.getTips = async (req, res) => {
    try {
        const tips = [
            { id: 1, icon: 'fa-recycle', message: 'Separate wet and dry waste for better points' },
            { id: 2, icon: 'fa-water', message: 'Rinse recyclables before disposal' },
            { id: 3, icon: 'fa-leaf', message: 'Compost organic waste at home' },
            { id: 4, icon: 'fa-battery', message: 'Dispose hazardous waste at special centers' }
        ];
        
        res.json({ tips });
        
    } catch (error) {
        console.error('Get tips error:', error);
        res.status(500).json({ error: 'Failed to get tips' });
    }
};
