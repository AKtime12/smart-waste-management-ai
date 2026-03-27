/**
 * User Model
 * Represents system users (Admin, Collector, Household, Open User)
 */

const { prisma } = require('../database/db');

class UserModel {
    /**
     * Create a new user
     * @param {Object} userData - User data
     * @returns {Promise<Object>} Created user
     */
    static async create(userData) {
        return await prisma.user.create({
            data: {
                email: userData.email,
                password: userData.password,
                name: userData.name,
                role: userData.role || 'HOUSEHOLD',
                phone: userData.phone,
                address: userData.address,
                latitude: userData.latitude,
                longitude: userData.longitude,
                points: userData.points || 0,
                qrCode: userData.qrCode
            }
        });
    }

    /**
     * Find user by ID
     * @param {string} id - User ID
     * @returns {Promise<Object>} User object
     */
    static async findById(id) {
        return await prisma.user.findUnique({
            where: { id },
            include: {
                collections: {
                    orderBy: { collectionTime: 'desc' },
                    take: 10
                },
                pointsHistory: {
                    orderBy: { createdAt: 'desc' },
                    take: 20
                },
                reports: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            }
        });
    }

    /**
     * Find user by email
     * @param {string} email - User email
     * @returns {Promise<Object>} User object
     */
    static async findByEmail(email) {
        return await prisma.user.findUnique({
            where: { email }
        });
    }

    /**
     * Find user by QR code
     * @param {string} qrCode - QR code
     * @returns {Promise<Object>} User object
     */
    static async findByQRCode(qrCode) {
        return await prisma.user.findUnique({
            where: { qrCode }
        });
    }

    /**
     * Get all users with filters
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} List of users
     */
    static async findAll(filters = {}) {
        const { role, search, page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = filters;
        
        const where = {};
        if (role) where.role = role;
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } }
            ];
        }
        
        return await prisma.user.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                phone: true,
                address: true,
                points: true,
                createdAt: true,
                _count: {
                    select: { collections: true, reports: true }
                }
            }
        });
    }

    /**
     * Update user
     * @param {string} id - User ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object>} Updated user
     */
    static async update(id, updateData) {
        return await prisma.user.update({
            where: { id },
            data: updateData
        });
    }

    /**
     * Update user points
     * @param {string} id - User ID
     * @param {number} points - Points to add (positive) or subtract (negative)
     * @param {string} reason - Reason for point change
     * @returns {Promise<Object>} Updated user
     */
    static async updatePoints(id, points, reason) {
        return await prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
                where: { id },
                data: { points: { increment: points } }
            });
            
            await tx.pointTransaction.create({
                data: {
                    userId: id,
                    points: points,
                    reason: reason
                }
            });
            
            return user;
        });
    }

    /**
     * Delete user
     * @param {string} id - User ID
     * @returns {Promise<Object>} Deleted user
     */
    static async delete(id) {
        return await prisma.user.delete({
            where: { id }
        });
    }

    /**
     * Get user statistics
     * @param {string} id - User ID
     * @returns {Promise<Object>} User stats
     */
    static async getStats(id) {
        const [collections, pointsHistory, reports] = await Promise.all([
            prisma.collection.count({ where: { householdId: id } }),
            prisma.pointTransaction.aggregate({
                where: { userId: id, points: { gt: 0 } },
                _sum: { points: true }
            }),
            prisma.report.count({ where: { userId: id } })
        ]);
        
        return {
            totalCollections: collections,
            totalPoints: pointsHistory._sum.points || 0,
            totalReports: reports,
            joinedAt: await prisma.user.findUnique({ where: { id }, select: { createdAt: true } })
        };
    }

    /**
     * Get leaderboard
     * @param {string} type - Leaderboard type ('households', 'collectors')
     * @param {number} limit - Number of entries
     * @returns {Promise<Array>} Leaderboard entries
     */
    static async getLeaderboard(type = 'households', limit = 20) {
        const role = type === 'collectors' ? 'COLLECTOR' : 'HOUSEHOLD';
        
        return await prisma.user.findMany({
            where: { role },
            orderBy: { points: 'desc' },
            take: limit,
            select: {
                id: true,
                name: true,
                points: true,
                _count: {
                    select: { collections: true }
                }
            }
        });
    }
}

module.exports = UserModel;