const { prisma } = require('../database/db');

// Get ward stats
exports.getWardStats = async (req, res) => {
    try {
        // Return demo ward data
        res.json({
            wards: [
                { name: 'Ward A', rank: 1, participationRate: 92, carbonSaved: 450, points: 1250, goal: 2000 },
                { name: 'Ward B', rank: 2, participationRate: 78, carbonSaved: 320, points: 890, goal: 2000 },
                { name: 'Ward C', rank: 3, participationRate: 65, carbonSaved: 210, points: 540, goal: 2000 }
            ]
        });
        
    } catch (error) {
        console.error('Get ward stats error:', error);
        res.status(500).json({ error: 'Failed to get ward stats' });
    }
};

// Get points leaderboard
exports.getLeaderboard = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { points: 'desc' },
            take: 20,
            select: {
                id: true,
                name: true,
                points: true,
                role: true
            }
        });
        
        res.json({ leaderboard: users });
        
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Failed to get leaderboard' });
    }
};
