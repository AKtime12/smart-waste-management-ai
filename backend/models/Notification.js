/**
 * Notification Model
 * Represents user notifications
 */

const { prisma } = require('../database/db');

class NotificationModel {
    /**
     * Create a new notification
     * @param {Object} notificationData - Notification data
     * @returns {Promise<Object>} Created notification
     */
    static async create(notificationData) {
        return await prisma.notification.create({
            data: {
                userId: notificationData.userId,
                title: notificationData.title,
                message: notificationData.message,
                type: notificationData.type,
                data: notificationData.data ? JSON.stringify(notificationData.data) : null,
                priority: notificationData.priority || 'normal'
            }
        });
    }

    /**
     * Create notifications for multiple users
     * @param {Array} userIds - List of user IDs
     * @param {Object} notificationData - Notification data
     * @returns {Promise<Array>} Created notifications
     */
    static async createBulk(userIds, notificationData) {
        const notifications = userIds.map(userId => ({
            userId,
            title: notificationData.title,
            message: notificationData.message,
            type: notificationData.type,
            data: notificationData.data ? JSON.stringify(notificationData.data) : null,
            priority: notificationData.priority || 'normal'
        }));
        
        return await prisma.notification.createMany({
            data: notifications
        });
    }

    /**
     * Get notifications for user
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} List of notifications
     */
    static async findByUser(userId, options = {}) {
        const { page = 1, limit = 20, unreadOnly = false } = options;
        
        const where = { userId };
        if (unreadOnly) where.read = false;
        
        return await prisma.notification.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Get unread count for user
     * @param {string} userId - User ID
     * @returns {Promise<number>} Unread count
     */
    static async getUnreadCount(userId) {
        return await prisma.notification.count({
            where: { userId, read: false }
        });
    }

    /**
     * Mark notification as read
     * @param {string} id - Notification ID
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Updated notification
     */
    static async markAsRead(id, userId) {
        return await prisma.notification.update({
            where: { id, userId },
            data: { read: true }
        });
    }

    /**
     * Mark all notifications as read for user
     * @param {string} userId - User ID
     * @returns {Promise<number>} Number of updated notifications
     */
    static async markAllAsRead(userId) {
        const result = await prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true }
        });
        
        return result.count;
    }

    /**
     * Delete notification
     * @param {string} id - Notification ID
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Deleted notification
     */
    static async delete(id, userId) {
        return await prisma.notification.delete({
            where: { id, userId }
        });
    }

    /**
     * Delete all notifications for user
     * @param {string} userId - User ID
     * @returns {Promise<number>} Number of deleted notifications
     */
    static async deleteAll(userId) {
        const result = await prisma.notification.deleteMany({
            where: { userId }
        });
        
        return result.count;
    }

    /**
     * Get notification statistics
     * @param {string} userId - User ID (optional)
     * @returns {Promise<Object>} Notification statistics
     */
    static async getStats(userId = null) {
        const where = userId ? { userId } : {};
        
        const [total, read, unread, byType] = await Promise.all([
            prisma.notification.count({ where }),
            prisma.notification.count({ where: { ...where, read: true } }),
            prisma.notification.count({ where: { ...where, read: false } }),
            prisma.notification.groupBy({
                by: ['type'],
                where,
                _count: true
            })
        ]);
        
        return {
            total,
            read,
            unread,
            readRate: total > 0 ? (read / total) * 100 : 0,
            byType: byType.reduce((acc, t) => {
                acc[t.type] = t._count;
                return acc;
            }, {})
        };
    }
}

module.exports = NotificationModel;