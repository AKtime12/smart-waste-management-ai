// backend/services/rewardsService.js
const { prisma } = require('../database/db');

class RewardsService {
    constructor() {
        this.pointMultipliers = {
            EXCELLENT: 2.0,
            GOOD: 1.5,
            POOR: 0.5,
            FAILED: 0
        };
        
        this.wardRewards = {
            GOLD: { minPoints: 10000, bonus: 500 },
            SILVER: { minPoints: 5000, bonus: 250 },
            BRONZE: { minPoints: 2000, bonus: 100 }
        };
    }
    
    // Calculate points for a collection
    calculatePoints(collection) {
        let points = 10; // Base points
        
        // Quality multiplier
        const multiplier = this.pointMultipliers[collection.segregationQuality] || 1;
        points *= multiplier;
        
        // Weight bonus (1 point per 5kg)
        if (collection.wasteWeight) {
            points += Math.floor(collection.wasteWeight / 5);
        }
        
        // Factory verification bonus
        if (collection.factoryVerified) {
            points += 5;
        }
        
        return Math.floor(points);
    }
    
    // Award points to household (with optional transaction type)
    async awardPoints(householdId, points, reason, collectionId = null, transactionType = 'COLLECTION') {
        // Update user points
        const updatedUser = await prisma.user.update({
            where: { id: householdId },
            data: { points: { increment: points } }
        });
        
        // Record transaction with provided type
        await prisma.pointTransaction.create({
            data: {
                userId: householdId,
                points: points,
                reason: reason,
                collectionId: collectionId,
                type: transactionType
            }
        });
        
        // Check for tier upgrade
        await this.checkTierUpgrade(householdId);
        
        return updatedUser.points;
    }
    
    // Calculate ward points (unchanged)
    async calculateWardPoints(wardId) {
        const collections = await prisma.collection.findMany({
            where: {
                bin: { ward: wardId },
                factoryVerified: true
            },
            include: { household: true }
        });
        
        const totalPoints = collections.reduce((sum, c) => sum + (c.pointsAwarded || 0), 0);
        const households = await prisma.user.count({
            where: { address: { contains: wardId } }
        });
        
        return {
            ward: wardId,
            totalPoints: totalPoints,
            averagePoints: households ? totalPoints / households : 0,
            rank: await this.getWardRank(wardId, totalPoints)
        };
    }
    
    // Check tier upgrade
    async checkTierUpgrade(userId) {
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        
        if (!user) return;
        
        let newTier = user.tier || 'BASIC';
        if (user.points >= 10000) newTier = 'PLATINUM';
        else if (user.points >= 5000) newTier = 'GOLD';
        else if (user.points >= 2000) newTier = 'SILVER';
        else if (user.points >= 500) newTier = 'BRONZE';
        
        if (newTier !== user.tier) {
            await prisma.user.update({
                where: { id: userId },
                data: { tier: newTier }
            });
            
            // Award tier upgrade bonus (uses COLLECTION type, but we can pass 'TIER_UPGRADE')
            const bonus = this.getTierBonus(newTier);
            if (bonus > 0) {
                await this.awardPoints(userId, bonus, `Tier upgrade to ${newTier}`, null, 'TIER_UPGRADE');
            }
        }
        
        return newTier;
    }
    
    getTierBonus(tier) {
        const bonuses = {
            PLATINUM: 1000,
            GOLD: 500,
            SILVER: 200,
            BRONZE: 50
        };
        return bonuses[tier] || 0;
    }
    
    async getWardRank(wardId, points) {
        // Get all wards with their total points
        const allWards = await prisma.collection.groupBy({
            by: ['bin', 'ward'],
            _sum: { pointsAwarded: true }
        });
        
        // Actually, we need to group by ward properly.
        // Since bin has ward, we can query and aggregate.
        const wardPoints = await prisma.qRBin.groupBy({
            by: ['ward'],
            _sum: { currentFill: true } // placeholder, but we need points
        });
        
        // Alternative: Query all collections, group manually or use SQL.
        // For simplicity, we'll fetch all bins and sum their associated collection points.
        const bins = await prisma.qRBin.findMany({
            include: {
                collections: {
                    select: { pointsAwarded: true }
                }
            }
        });
        
        const wardTotals = {};
        for (const bin of bins) {
            const total = bin.collections.reduce((sum, c) => sum + (c.pointsAwarded || 0), 0);
            if (!wardTotals[bin.ward]) wardTotals[bin.ward] = 0;
            wardTotals[bin.ward] += total;
        }
        
        const sorted = Object.entries(wardTotals).sort((a, b) => b[1] - a[1]);
        const rank = sorted.findIndex(([ward]) => ward === wardId) + 1;
        return rank;
    }
}

module.exports = RewardsService;