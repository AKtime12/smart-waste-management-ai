// backend/controllers/factoryController.js
const { prisma } = require('../database/db');
const RewardsService = require('../services/rewardsService');
const rewardsService = new RewardsService();

// Simulated AI classification – replace with real model
async function classifyAtFactory(imageUrl) {
    // In production, call your TensorFlow/Python service here
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
        const { collectionId, imageUrl } = req.body;

        // 1. Find the collection
        const collection = await prisma.collection.findUnique({
            where: { id: collectionId },
            include: { household: true }
        });

        if (!collection) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // 2. Run AI classification on the waste image
        const factoryResult = await classifyAtFactory(imageUrl);

        // 3. Compare with recorded segregation quality
        const wasCorrect = factoryResult.category === collection.segregationQuality;

        // 4. Update collection with factory verification data
        await prisma.collection.update({
            where: { id: collectionId },
            data: {
                factoryVerified: true,
                factoryVerifiedAt: new Date(),
                factoryQuality: factoryResult.category,
                factoryImageUrl: imageUrl
            }
        });

        // 5. Award bonus points if correct (using RewardsService)
        let bonusPoints = 0;
        if (wasCorrect) {
            bonusPoints = calculateBonusPoints(collection);
            await rewardsService.awardPoints(
                collection.householdId,
                bonusPoints,
                `Factory verification bonus for proper segregation (${factoryResult.category})`,
                collectionId
            );
        }

        // 6. Return response
        res.json({
            success: true,
            verified: wasCorrect,
            bonusPoints,
            message: wasCorrect
                ? `✓ Verified! +${bonusPoints} bonus points`
                : `✗ Segregation mismatch – expected ${collection.segregationQuality}, got ${factoryResult.category}`
        });

    } catch (error) {
        console.error('Factory verification error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
};

// Endpoint to get all unverified collections (for admin/factory dashboard)
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