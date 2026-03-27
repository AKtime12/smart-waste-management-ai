/**
 * Collection Model
 * Represents waste collection records
 */

const { prisma } = require('../database/db');

class CollectionModel {
    /**
     * Create a new collection record
     * @param {Object} collectionData - Collection data
     * @returns {Promise<Object>} Created collection
     */
    static async create(collectionData) {
        return await prisma.collection.create({
            data: {
                binId: collectionData.binId,
                householdId: collectionData.householdId,
                collectorId: collectionData.collectorId,
                wasteWeight: collectionData.wasteWeight,
                segregationQuality: collectionData.segregationQuality,
                imageUrl: collectionData.imageUrl,
                pointsAwarded: collectionData.pointsAwarded,
                aiVerified: collectionData.aiVerified || false,
                notes: collectionData.notes
            },
            include: {
                bin: true,
                household: {
                    select: { name: true, address: true }
                },
                collector: {
                    select: { name: true }
                }
            }
        });
    }

    /**
     * Find collection by ID
     * @param {string} id - Collection ID
     * @returns {Promise<Object>} Collection object
     */
    static async findById(id) {
        return await prisma.collection.findUnique({
            where: { id },
            include: {
                bin: true,
                household: true,
                collector: true
            }
        });
    }

    /**
     * Get collections by household
     * @param {string} householdId - Household ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} List of collections
     */
    static async findByHousehold(householdId, options = {}) {
        const { page = 1, limit = 20, startDate, endDate } = options;
        
        const where = { householdId };
        if (startDate && endDate) {
            where.collectionTime = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }
        
        return await prisma.collection.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { collectionTime: 'desc' },
            include: {
                bin: true,
                collector: {
                    select: { name: true }
                }
            }
        });
    }

    /**
     * Get collections by collector
     * @param {string} collectorId - Collector ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} List of collections
     */
    static async findByCollector(collectorId, options = {}) {
        const { page = 1, limit = 20, startDate, endDate } = options;
        
        const where = { collectorId };
        if (startDate && endDate) {
            where.collectionTime = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }
        
        return await prisma.collection.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { collectionTime: 'desc' },
            include: {
                bin: true,
                household: {
                    select: { name: true, address: true }
                }
            }
        });
    }

    /**
     * Get collections by bin
     * @param {string} binId - Bin ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} List of collections
     */
    static async findByBin(binId, options = {}) {
        const { page = 1, limit = 20 } = options;
        
        return await prisma.collection.findMany({
            where: { binId },
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { collectionTime: 'desc' },
            include: {
                household: {
                    select: { name: true }
                },
                collector: {
                    select: { name: true }
                }
            }
        });
    }

    /**
     * Get daily collection summary
     * @param {Date} date - Date for summary
     * @returns {Promise<Object>} Daily summary
     */
    static async getDailySummary(date = new Date()) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        
        const [collections, totals] = await Promise.all([
            prisma.collection.findMany({
                where: {
                    collectionTime: { gte: start, lte: end }
                },
                include: { bin: true }
            }),
            prisma.collection.aggregate({
                where: {
                    collectionTime: { gte: start, lte: end }
                },
                _sum: {
                    wasteWeight: true,
                    pointsAwarded: true
                },
                _count: true
            })
        ]);
        
        const byType = {};
        for (const collection of collections) {
            const type = collection.bin?.binType || 'UNKNOWN';
            byType[type] = (byType[type] || 0) + (collection.wasteWeight || 0);
        }
        
        return {
            date: start,
            totalCollections: totals._count,
            totalWaste: totals._sum.wasteWeight || 0,
            totalPoints: totals._sum.pointsAwarded || 0,
            byType: byType,
            averageWeight: totals._count > 0 ? (totals._sum.wasteWeight / totals._count) : 0
        };
    }

    /**
     * Get collection statistics for a period
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object>} Statistics
     */
    static async getStats(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const [collections, byQuality, byBinType] = await Promise.all([
            prisma.collection.aggregate({
                where: {
                    collectionTime: { gte: start, lte: end }
                },
                _sum: {
                    wasteWeight: true,
                    pointsAwarded: true
                },
                _count: true
            }),
            prisma.collection.groupBy({
                by: ['segregationQuality'],
                where: {
                    collectionTime: { gte: start, lte: end }
                },
                _count: true,
                _sum: { wasteWeight: true }
            }),
            prisma.collection.findMany({
                where: {
                    collectionTime: { gte: start, lte: end }
                },
                include: { bin: true }
            })
        ]);
        
        const byBinTypeMap = {};
        for (const collection of byBinType) {
            const type = collection.bin?.binType || 'UNKNOWN';
            byBinTypeMap[type] = (byBinTypeMap[type] || 0) + (collection.wasteWeight || 0);
        }
        
        return {
            period: { start, end },
            totalCollections: collections._count,
            totalWaste: collections._sum.wasteWeight || 0,
            totalPoints: collections._sum.pointsAwarded || 0,
            byQuality: byQuality,
            byBinType: byBinTypeMap
        };
    }

    /**
     * Update collection
     * @param {string} id - Collection ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated collection
     */
    static async update(id, updateData) {
        return await prisma.collection.update({
            where: { id },
            data: updateData
        });
    }

    /**
     * Delete collection
     * @param {string} id - Collection ID
     * @returns {Promise<Object>} Deleted collection
     */
    static async delete(id) {
        return await prisma.collection.delete({
            where: { id }
        });
    }

    /**
     * Get collection trends
     * @param {number} days - Number of days
     * @returns {Promise<Array>} Daily trends
     */
    static async getTrends(days = 30) {
        const trends = [];
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        for (let i = 0; i <= days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const summary = await this.getDailySummary(date);
            trends.push(summary);
        }
        
        return trends;
    }
}

module.exports = CollectionModel;