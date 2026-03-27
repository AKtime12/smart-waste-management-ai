// backend/controllers/factoryController.js
const { prisma } = require('../database/db');
const RewardsService = require('../services/rewardsService');
const rewardsService = new RewardsService();

// Simulated AI classification – used only if frontend doesn't send a prediction
async function classifyAtFactory(imageUrl) {
    const categories = ['ORGANIC', 'RECYCLABLE', 'NON_RECYCLABLE', 'HAZARDOUS'];
    const randomIndex = Math.floor(Math.random() * categories.length);
    return { category: categories[randomIndex], confidence: 85 };
}

function calculateBonusPoints(collection) {
    let bonus = 10;
    if (collection.segregationQuality === 'EXCELLENT') bonus = 20;
    else if (collection.segregationQuality === 'GOOD') bonus = 10;
    else bonus = 5;

    if (collection.wasteWeight) {
        bonus += Math.floor(collection.wasteWeight / 5);
    }
    return bonus;
}

// Endpoint to verify a collection at the factory
exports.verifyWasteAtFactory = async (req, res) => {
    try {
        const { collectionId, imageUrl, predictedCategory, confidence } = req.body;

        const collection = await prisma.collection.findUnique({
            where: { id: collectionId },
            include: { household: true }
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        let factoryResult;
        if (predictedCategory) {
            factoryResult = { category: predictedCategory, confidence: confidence || 0.8 };
        } else {
            factoryResult = await classifyAtFactory(imageUrl);
        }

        const wasCorrect = factoryResult.category === collection.segregationQuality;

        await prisma.collection.update({
            where: { id: collectionId },
            data: {
                factoryVerified: true,
                factoryVerifiedAt: new Date(),
                factoryQuality: factoryResult.category,
                factoryImageUrl: imageUrl || null
            }
        });

        let bonusPoints = 0;
        if (wasCorrect) {
            bonusPoints = calculateBonusPoints(collection);
            await rewardsService.awardPoints(
                collection.householdId,
                bonusPoints,
                `Factory verification bonus for proper segregation (${factoryResult.category})`,
                collectionId,
                'FACTORY_VERIFIED'  // transaction type
            );
        }

        res.json({
            success: true,
            verified: wasCorrect,
            bonusPoints,
            message: wasCorrect
                ? `✓ Verified! Waste matches recorded segregation. +${bonusPoints} bonus points`
                : `✗ Segregation mismatch – expected ${collection.segregationQuality}, got ${factoryResult.category}`
        });

    } catch (error) {
        console.error('Factory verification error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
};

// Endpoint to get all unverified collections
exports.getPendingVerifications = async (req, res) => {
    try {
        const collections = await prisma.collection.findMany({
            where: { factoryVerified: false },
            include: {
                household: { select: { name: true, email: true } },
                bin: { select: { ward: true, locality: true } }
            },
            orderBy: { collectionTime: 'desc' },
            take: 50
        });

        res.json({ collections });
    } catch (error) {
        console.error('Error fetching pending verifications:', error);
        res.status(500).json({ error: 'Failed to fetch pending verifications' });
    }
};

// Endpoint to get verification history (last 10 verified collections)
exports.getVerificationHistory = async (req, res) => {
    try {
        const history = await prisma.collection.findMany({
            where: { factoryVerified: true },
            orderBy: { factoryVerifiedAt: 'desc' },
            take: 10,
            include: {
                household: { select: { name: true, email: true } },
                bin: { select: { binType: true, locality: true } }
            }
        });

        const formatted = history.map(c => ({
            id: c.id,
            household: c.household,
            bin: c.bin,
            wasteWeight: c.wasteWeight,
            segregationQuality: c.segregationQuality,
            factoryQuality: c.factoryQuality,
            factoryVerified: c.factoryVerified,
            bonusPoints: calculateBonusPoints(c), // recalc bonus points based on collection data
            verifiedAt: c.factoryVerifiedAt
        }));

        res.json({ history: formatted });
    } catch (error) {
        console.error('Error fetching verification history:', error);
        res.status(500).json({ error: 'Failed to fetch verification history' });
    }
};

// Endpoint to get factory statistics (today's verified count, bonus points, AI accuracy)
exports.getFactoryStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const verifiedToday = await prisma.collection.count({
            where: { factoryVerified: true, factoryVerifiedAt: { gte: today } }
        });

        const bonusPointsTodayResult = await prisma.pointTransaction.aggregate({
            where: {
                type: 'FACTORY_VERIFIED',
                createdAt: { gte: today }
            },
            _sum: { points: true }
        });
        const bonusPointsToday = bonusPointsTodayResult._sum.points || 0;

        // Placeholder for AI accuracy – you can compute from actual comparisons later
        const aiAccuracy = 85;

        res.json({
            verifiedToday,
            bonusPointsToday,
            aiAccuracy
        });
    } catch (error) {
        console.error('Error fetching factory stats:', error);
        res.status(500).json({ error: 'Failed to fetch factory stats' });
    }
};