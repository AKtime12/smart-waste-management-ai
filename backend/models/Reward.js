/**
 * Reward Model
 * Represents rewards available for redemption
 */

const { prisma } = require('../database/db');

class RewardModel {
    /**
     * Create a new reward
     * @param {Object} rewardData - Reward data
     * @returns {Promise<Object>} Created reward
     */
    static async create(rewardData) {
        return await prisma.reward.create({
            data: {
                name: rewardData.name,
                description: rewardData.description,
                points: rewardData.points,
                category: rewardData.category,
                stock: rewardData.stock || 100,
                imageUrl: rewardData.imageUrl,
                isActive: rewardData.isActive !== false
            }
        });
    }

    /**
     * Find reward by ID
     * @param {string} id - Reward ID
     * @returns {Promise<Object>} Reward object
     */
    static async findById(id) {
        return await prisma.reward.findUnique({
            where: { id }
        });
    }

    /**
     * Get all active rewards
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} List of rewards
     */
    static async findAll(filters = {}) {
        const { category, minPoints, maxPoints, page = 1, limit = 20 } = filters;
        
        const where = { isActive: true };
        if (category) where.category = category;
        if (minPoints) where.points = { gte: minPoints };
        if (maxPoints) where.points = { ...where.points, lte: maxPoints };
        
        return await prisma.reward.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { points: 'asc' }
        });
    }

    /**
     * Update reward
     * @param {string} id - Reward ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated reward
     */
    static async update(id, updateData) {
        return await prisma.reward.update({
            where: { id },
            data: updateData
        });
    }

    /**
     * Decrease reward stock
     * @param {string} id - Reward ID
     * @param {number} quantity - Quantity to decrease
     * @returns {Promise<Object>} Updated reward
     */
    static async decreaseStock(id, quantity = 1) {
        return await prisma.reward.update({
            where: { id },
            data: { stock: { decrement: quantity } }
        });
    }

    /**
     * Check if reward is available
     * @param {string} id - Reward ID
     * @param {number} points - User points
     * @returns {Promise<Object>} Availability status
     */
    static async checkAvailability(id, points) {
        const reward = await this.findById(id);
        
        if (!reward) {
            return { available: false, reason: 'Reward not found' };
        }
        
        if (!reward.isActive) {
            return { available: false, reason: 'Reward is not active' };
        }
        
        if (reward.stock <= 0) {
            return { available: false, reason: 'Reward out of stock' };
        }
        
        if (points < reward.points) {
            return { available: false, reason: 'Insufficient points' };
        }
        
        return { available: true, reward };
    }

    /**
     * Redeem reward for user
     * @param {string} rewardId - Reward ID
     * @param {string} userId - User ID
     * @param {number} userPoints - User's current points
     * @returns {Promise<Object>} Redemption result
     */
    static async redeem(rewardId, userId, userPoints) {
        const availability = await this.checkAvailability(rewardId, userPoints);
        if (!availability.available) {
            return availability;
        }
        
        const reward = availability.reward;
        
        return await prisma.$transaction(async (tx) => {
            // Decrease reward stock
            await tx.reward.update({
                where: { id: rewardId },
                data: { stock: { decrement: 1 } }
            });
            
            // Deduct points from user
            const user = await tx.user.update({
                where: { id: userId },
                data: { points: { decrement: reward.points } }
            });
            
            // Create redemption record
            const redemption = await tx.redeemHistory.create({
                data: {
                    userId: userId,
                    rewardId: rewardId,
                    rewardName: reward.name,
                    points: reward.points,
                    status: 'COMPLETED'
                }
            });
            
            // Create point transaction
            await tx.pointTransaction.create({
                data: {
                    userId: userId,
                    points: -reward.points,
                    reason: `Redeemed: ${reward.name}`,
                    collectionId: null
                }
            });
            
            return {
                success: true,
                redemption,
                remainingPoints: user.points,
                redemptionCode: this.generateRedemptionCode()
            };
        });
    }

    /**
     * Generate redemption code
     * @returns {string} Redemption code
     */
    static generateRedemptionCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 12; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
            if (i === 3 || i === 7) code += '-';
        }
        return code;
    }

    /**
     * Get redemption history for user
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} Redemption history
     */
    static async getRedemptionHistory(userId, options = {}) {
        const { page = 1, limit = 20 } = options;
        
        return await prisma.redeemHistory.findMany({
            where: { userId },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                reward: true
            }
        });
    }

    /**
     * Delete reward
     * @param {string} id - Reward ID
     * @returns {Promise<Object>} Deleted reward
     */
    static async delete(id) {
        return await prisma.reward.delete({
            where: { id }
        });
    }
}

module.exports = RewardModel;