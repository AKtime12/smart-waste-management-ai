const { prisma } = require('../database/db');

// =============================================
// Dashboard Stats (Live data)
// =============================================
exports.getDashboardStats = async (req, res) => {
    try {
        const [totalUsers, totalCollections, totalPoints, totalWaste, activeCollectors, fullBins, pendingReports] = await Promise.all([
            prisma.user.count(),
            prisma.collection.count(),
            prisma.user.aggregate({ _sum: { points: true } }),
            prisma.collection.aggregate({ _sum: { wasteWeight: true } }),
            prisma.user.count({ where: { role: 'COLLECTOR' } }),
            prisma.qRBin.count({ where: { isFull: true } }),
            prisma.report.count({ where: { status: 'PENDING' } })
        ]);

        const carbonSaved = totalWaste._sum.wasteWeight ? (totalWaste._sum.wasteWeight * 0.5) / 1000 : 0;

        const recentCollections = await prisma.collection.findMany({
            take: 7,
            orderBy: { collectionTime: 'desc' },
            include: { bin: true, household: true }
        });

        const topPerformers = await prisma.user.findMany({
            where: { role: 'HOUSEHOLD' },
            orderBy: { points: 'desc' },
            take: 3,
            select: { name: true, points: true }
        });

        const recentReports = await prisma.report.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { name: true } } }
        });

        res.json({
            totalUsers,
            totalCollections,
            totalPoints: totalPoints._sum.points || 0,
            carbonSaved: carbonSaved.toFixed(1),
            activeCollectors,
            fullBins,
            pendingReports,
            recentCollections: recentCollections.map(c => ({
                id: c.id,
                collectionTime: c.collectionTime,
                wasteWeight: c.wasteWeight,
                segregationQuality: c.segregationQuality,
                pointsAwarded: c.pointsAwarded,
                binType: c.bin?.binType,
                locality: c.bin?.locality,
                householdName: c.household?.name
            })),
            topPerformers,
            recentReports: recentReports.map(r => ({
                id: r.id,
                description: r.description,
                status: r.status,
                createdAt: r.createdAt,
                userName: r.user?.name
            }))
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ error: 'Failed to load dashboard stats' });
    }
};

// =============================================
// Analytics (placeholder)
// =============================================
exports.getAnalytics = async (req, res) => {
    try {
        res.json({ message: 'Analytics endpoint – to be implemented' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// =============================================
// User Management
// =============================================
exports.getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                points: true,
                createdAt: true
            }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getUser = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                points: true,
                createdAt: true
            }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { email, password, name, role, points } = req.body;
        const hashed = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { email, password: hashed, name, role, points: points || 0 }
        });
        res.status(201).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const { name, role, points } = req.body;
        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { name, role, points }
        });
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteUser = async (req, res) => {
    try {
        await prisma.user.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// =============================================
// Bin Management
// =============================================
exports.getAllBins = async (req, res) => {
    try {
        const bins = await prisma.qRBin.findMany();
        res.json(bins);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.createBin = async (req, res) => {
    try {
        const bin = await prisma.qRBin.create({ data: req.body });
        res.status(201).json({ success: true, bin });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateBin = async (req, res) => {
    try {
        const bin = await prisma.qRBin.update({
            where: { id: req.params.id },
            data: req.body
        });
        res.json({ success: true, bin });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.deleteBin = async (req, res) => {
    try {
        await prisma.qRBin.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// =============================================
// Collector Management
// =============================================
exports.getCollectors = async (req, res) => {
    try {
        const collectors = await prisma.user.findMany({
            where: { role: 'COLLECTOR' },
            include: {
                collections: {
                    select: { id: true, pointsAwarded: true, wasteWeight: true }
                }
            }
        });
        const formatted = collectors.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            collections: c.collections.length,
            points: c.collections.reduce((sum, col) => sum + (col.pointsAwarded || 0), 0)
        }));
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.assignCollector = async (req, res) => {
    // Placeholder – implement as needed
    res.json({ success: true, message: 'Collector assigned' });
};

// =============================================
// Report Management
// =============================================
exports.getReports = async (req, res) => {
    try {
        const reports = await prisma.report.findMany({
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateReportStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const report = await prisma.report.update({
            where: { id: req.params.id },
            data: { status, resolvedAt: status === 'RESOLVED' ? new Date() : null }
        });
        res.json({ success: true, report });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// =============================================
// Predictions
// =============================================
exports.getPredictions = async (req, res) => {
    try {
        const predictions = await prisma.prediction.findMany({
            where: { date: { gte: new Date() } },
            orderBy: { date: 'asc' },
            take: 7
        });
        res.json(predictions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getFestivalPredictions = async (req, res) => {
    // Placeholder – implement with actual logic
    res.json([{ festival: 'Diwali', predictedIncrease: 150 }]);
};

// =============================================
// Rewards
// =============================================
exports.createReward = async (req, res) => {
    try {
        const reward = await prisma.reward.create({ data: req.body });
        res.status(201).json({ success: true, reward });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getRewards = async (req, res) => {
    try {
        const rewards = await prisma.reward.findMany({ where: { isActive: true } });
        res.json(rewards);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// =============================================
// Ward Analytics
// =============================================
exports.getWardAnalytics = async (req, res) => {
    try {
        const wards = await prisma.ward.findMany({
            orderBy: { rank: 'asc' }
        });
        res.json(wards);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// =============================================
// Carbon Analytics
// =============================================
exports.getCarbonAnalytics = async (req, res) => {
    try {
        const totalWaste = await prisma.collection.aggregate({ _sum: { wasteWeight: true } });
        const carbonSaved = totalWaste._sum.wasteWeight ? (totalWaste._sum.wasteWeight * 0.5) / 1000 : 0;
        res.json({
            totalCarbonSaved: carbonSaved,
            monthlyCarbon: [] // optionally compute monthly
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};