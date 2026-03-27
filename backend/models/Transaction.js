/**
 * Transaction Model
 * Represents point transactions (earnings and redemptions)
 */

const { prisma } = require('../database/db');

class TransactionModel {
    /**
     * Create a new point transaction
     * @param {Object} transactionData - Transaction data
     * @returns {Promise<Object>} Created transaction
     */
    static async create(transactionData) {
        return await prisma.pointTransaction.create({
            data: {
                userId: transactionData.userId,
                points: transactionData.points,
                reason: transactionData.reason,
                collectionId: transactionData.collectionId
            }
        });
    }

    /**
     * Get transactions by user
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} List of transactions
     */
    static async findByUser(userId, options = {}) {
        const { page = 1, limit = 20, startDate, endDate } = options;
        
        const where = { userId };
        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }
        
        return await prisma.pointTransaction.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                collection: {
                    include: {
                        bin: true
                    }
                }
            }
        });
    }

    /**
     * Get transaction summary
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Transaction summary
     */
    static async getSummary(userId) {
        const [earned, spent, last30Days] = await Promise.all([
            prisma.pointTransaction.aggregate({
                where: { userId, points: { gt: 0 } },
                _sum: { points: true }
            }),
            prisma.pointTransaction.aggregate({
                where: { userId, points: { lt: 0 } },
                _sum: { points: true }
            }),
            prisma.pointTransaction.findMany({
                where: {
                    userId,
                    createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                },
                orderBy: { createdAt: 'asc' }
            })
        ]);
        
        // Calculate daily average for last 30 days
        const dailyAverage = last30Days.length > 0 
            ? last30Days.reduce((sum, t) => sum + (t.points > 0 ? t.points : 0), 0) / 30
            : 0;
        
        return {
            totalEarned: earned._sum.points || 0,
            totalSpent: Math.abs(spent._sum.points || 0),
            netPoints: (earned._sum.points || 0) + (spent._sum.points || 0),
            transactionCount: last30Days.length,
            dailyAverage: dailyAverage.toFixed(2),
            mostEarnedReason: await this.getMostEarnedReason(userId)
        };
    }

    /**
     * Get most common earning reason
     * @param {string} userId - User ID
     * @returns {Promise<string>} Most common reason
     */
    static async getMostEarnedReason(userId) {
        const result = await prisma.pointTransaction.groupBy({
            by: ['reason'],
            where: { userId, points: { gt: 0 } },
            _count: true,
            orderBy: { _count: { reason: 'desc' } },
            take: 1
        });
        
        return result[0]?.reason || 'No transactions';
    }

    /**
     * Get transaction statistics by date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object>} Transaction statistics
     */
    static async getStatsByDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const [byType, total, daily] = await Promise.all([
            prisma.pointTransaction.groupBy({
                by: ['reason'],
                where: {
                    createdAt: { gte: start, lte: end },
                    points: { gt: 0 }
                },
                _sum: { points: true }
            }),
            prisma.pointTransaction.aggregate({
                where: {
                    createdAt: { gte: start, lte: end }
                },
                _sum: { points: true }
            }),
            this.getDailyStats(start, end)
        ]);
        
        return {
            period: { start, end },
            totalPoints: total._sum.points || 0,
            byReason: byType,
            dailyStats: daily
        };
    }

    /**
     * Get daily transaction stats
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>} Daily stats
     */
    static async getDailyStats(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = [];
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayStart = new Date(d);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(d);
            dayEnd.setHours(23, 59, 59, 999);
            
            const [earned, spent] = await Promise.all([
                prisma.pointTransaction.aggregate({
                    where: {
                        createdAt: { gte: dayStart, lte: dayEnd },
                        points: { gt: 0 }
                    },
                    _sum: { points: true }
                }),
                prisma.pointTransaction.aggregate({
                    where: {
                        createdAt: { gte: dayStart, lte: dayEnd },
                        points: { lt: 0 }
                    },
                    _sum: { points: true }
                })
            ]);
            
            days.push({
                date: dayStart.toISOString().split('T')[0],
                earned: earned._sum.points || 0,
                spent: Math.abs(spent._sum.points || 0),
                net: (earned._sum.points || 0) + (spent._sum.points || 0)
            });
        }
        
        return days;
    }

    /**
     * Delete transaction
     * @param {string} id - Transaction ID
     * @returns {Promise<Object>} Deleted transaction
     */
    static async delete(id) {
        return await prisma.pointTransaction.delete({
            where: { id }
        });
    }
}

module.exports = TransactionModel;