/**
 * Report Model
 * Represents user reports for waste issues
 */

const { prisma } = require('../database/db');

class ReportModel {
    /**
     * Create a new report
     * @param {Object} reportData - Report data
     * @returns {Promise<Object>} Created report
     */
    static async create(reportData) {
        return await prisma.report.create({
            data: {
                userId: reportData.userId,
                imageUrl: reportData.imageUrl,
                latitude: reportData.latitude,
                longitude: reportData.longitude,
                description: reportData.description,
                status: 'PENDING'
            },
            include: {
                user: {
                    select: { name: true, email: true, phone: true }
                }
            }
        });
    }

    /**
     * Find report by ID
     * @param {string} id - Report ID
     * @returns {Promise<Object>} Report object
     */
    static async findById(id) {
        return await prisma.report.findUnique({
            where: { id },
            include: {
                user: {
                    select: { name: true, email: true, phone: true }
                }
            }
        });
    }

    /**
     * Get reports by user
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} List of reports
     */
    static async findByUser(userId, options = {}) {
        const { page = 1, limit = 20, status } = options;
        
        const where = { userId };
        if (status) where.status = status;
        
        return await prisma.report.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Get all reports with filters
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} List of reports
     */
    static async findAll(filters = {}) {
        const { status, page = 1, limit = 20, startDate, endDate, search } = filters;
        
        const where = {};
        if (status) where.status = status;
        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }
        if (search) {
            where.description = { contains: search };
        }
        
        return await prisma.report.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: { name: true, email: true, phone: true }
                }
            }
        });
    }

    /**
     * Get nearby reports
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     * @param {number} radius - Radius in km
     * @param {string} status - Report status filter
     * @returns {Promise<Array>} List of nearby reports
     */
    static async getNearby(lat, lng, radius = 5, status = 'PENDING') {
        // Get all reports with the specified status
        const reports = await prisma.report.findMany({
            where: { status },
            include: {
                user: {
                    select: { name: true, phone: true }
                }
            }
        });
        
        const { calculateDistance } = require('../utils/helpers');
        
        // Filter by distance
        const nearby = reports.filter(report => {
            const distance = calculateDistance(lat, lng, report.latitude, report.longitude);
            report.distance = distance;
            return distance <= radius;
        });
        
        return nearby.sort((a, b) => a.distance - b.distance);
    }

    /**
     * Update report status
     * @param {string} id - Report ID
     * @param {string} status - New status
     * @param {string} notes - Resolution notes
     * @returns {Promise<Object>} Updated report
     */
    static async updateStatus(id, status, notes = null) {
        const data = { status };
        if (status === 'RESOLVED') {
            data.resolvedAt = new Date();
        }
        if (notes) {
            data.notes = notes;
        }
        
        return await prisma.report.update({
            where: { id },
            data
        });
    }

    /**
     * Delete report
     * @param {string} id - Report ID
     * @returns {Promise<Object>} Deleted report
     */
    static async delete(id) {
        return await prisma.report.delete({
            where: { id }
        });
    }

    /**
     * Get report statistics
     * @returns {Promise<Object>} Report statistics
     */
    static async getStats() {
        const [pending, inProgress, resolved, rejected, total] = await Promise.all([
            prisma.report.count({ where: { status: 'PENDING' } }),
            prisma.report.count({ where: { status: 'IN_PROGRESS' } }),
            prisma.report.count({ where: { status: 'RESOLVED' } }),
            prisma.report.count({ where: { status: 'REJECTED' } }),
            prisma.report.count()
        ]);
        
        const avgResolutionTime = await prisma.$queryRaw`
            SELECT AVG(JULIANDAY(resolvedAt) - JULIANDAY(createdAt)) * 24 as hours
            FROM reports
            WHERE status = 'RESOLVED' AND resolvedAt IS NOT NULL
        `;
        
        return {
            total,
            pending,
            inProgress,
            resolved,
            rejected,
            resolutionRate: total > 0 ? (resolved / total) * 100 : 0,
            averageResolutionHours: avgResolutionTime[0]?.hours || 0
        };
    }
}

module.exports = ReportModel;