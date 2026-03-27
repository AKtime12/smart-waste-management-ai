/**
 * Notification Service - Push Notifications & Alerts
 * Handles all notification delivery across channels
 */

const { prisma } = require('../database/db');

class NotificationService {
    constructor(wsManager = null) {
        this.wsManager = wsManager;
        this.channels = {
            push: true,
            email: true,
            sms: true,
            inApp: true
        };
        this.templates = this.initializeTemplates();
    }

    initializeTemplates() {
        return {
            // Bin related notifications
            bin_full: {
                title: '⚠️ Bin Full Alert',
                body: 'Bin at {location} is {fillLevel}% full. Needs immediate collection!',
                priority: 'high',
                icon: '🚨',
                action: 'view_bin'
            },
            bin_near_full: {
                title: '⚠️ Bin Almost Full',
                body: 'Bin at {location} is {fillLevel}% full. Schedule collection soon.',
                priority: 'medium',
                icon: '⚠️',
                action: 'view_bin'
            },
            bin_issue: {
                title: '🛠️ Bin Issue Reported',
                body: 'Issue reported for bin at {location}: {issue}',
                priority: 'high',
                icon: '🔧',
                action: 'view_bin'
            },

            // Collection related notifications
            collection_scheduled: {
                title: '🗓️ Collection Scheduled',
                body: 'Your waste collection is scheduled for {date} at {time}',
                priority: 'normal',
                icon: '📅',
                action: 'view_collection'
            },
            collection_completed: {
                title: '✅ Collection Completed!',
                body: 'Your waste was collected. You earned +{points} points!',
                priority: 'normal',
                icon: '🎉',
                action: 'view_points'
            },
            collection_reminder: {
                title: '♻️ Collection Reminder',
                body: 'Don\'t forget to put out your waste for collection tomorrow',
                priority: 'normal',
                icon: '🔔',
                action: 'view_reminder'
            },
            collector_assigned: {
                title: '👤 Collector Assigned',
                body: '{collector} has been assigned to your area',
                priority: 'normal',
                icon: '🚛',
                action: 'view_collector'
            },

            // Points and rewards
            points_earned: {
                title: '🎉 Points Earned!',
                body: 'You earned {points} points for {reason}. Total: {total} points',
                priority: 'normal',
                icon: '⭐',
                action: 'view_points'
            },
            tier_upgrade: {
                title: '🏆 Tier Upgrade!',
                body: 'Congratulations! You\'ve reached {tier} Tier!',
                priority: 'high',
                icon: '🏆',
                action: 'view_tier'
            },
            reward_available: {
                title: '🎁 New Reward Available!',
                body: '{rewardName} is now available for {points} points',
                priority: 'normal',
                icon: '🎁',
                action: 'view_rewards'
            },
            reward_redeemed: {
                title: '✅ Reward Redeemed!',
                body: 'You redeemed {rewardName} for {points} points',
                priority: 'normal',
                icon: '🎫',
                action: 'view_redemption'
            },

            // Reports
            report_submitted: {
                title: '📋 Report Submitted',
                body: 'Your report has been submitted. Reference ID: {reportId}',
                priority: 'normal',
                icon: '📋',
                action: 'view_report'
            },
            report_updated: {
                title: '📋 Report Updated',
                body: 'Your report status has been updated to: {status}',
                priority: 'normal',
                icon: '🔄',
                action: 'view_report'
            },
            report_resolved: {
                title: '✅ Report Resolved',
                body: 'Your report at {location} has been resolved. Thank you!',
                priority: 'high',
                icon: '✅',
                action: 'view_report'
            },

            // System notifications
            system_alert: {
                title: 'ℹ️ System Update',
                body: '{message}',
                priority: 'normal',
                icon: 'ℹ️',
                action: 'view_system'
            },
            emergency: {
                title: '🚨 EMERGENCY ALERT',
                body: '{message}',
                priority: 'urgent',
                icon: '🚨',
                action: 'view_emergency'
            },
            maintenance: {
                title: '🔧 Maintenance Scheduled',
                body: 'System maintenance scheduled for {date}. Service may be affected.',
                priority: 'normal',
                icon: '🔧',
                action: 'view_maintenance'
            },

            // AI predictions
            prediction_alert: {
                title: '🤖 AI Prediction Alert',
                body: 'High waste volume predicted for {area} on {date}. Extra trucks deployed.',
                priority: 'medium',
                icon: '🤖',
                action: 'view_predictions'
            }
        };
    }

    // =============================================
    // Main Notification Methods
    // =============================================

    async sendNotification(userId, type, data, options = {}) {
        try {
            const template = this.templates[type];
            if (!template) {
                console.error(`Notification template not found: ${type}`);
                return false;
            }

            // Get user preferences
            const preferences = await this.getUserPreferences(userId);
            
            // Get user contact info
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, phone: true, name: true }
            });

            if (!user) return false;

            // Format message
            const formattedMessage = this.formatMessage(template.body, { ...data, name: user.name });
            const formattedTitle = this.formatMessage(template.title, { ...data, name: user.name });

            // Create notification record
            const notification = await this.createNotificationRecord(userId, type, formattedTitle, formattedMessage, data, template.priority);

            // Send through preferred channels
            const results = [];
            
            if (preferences.inApp !== false && (options.channel === undefined || options.channel === 'inApp')) {
                results.push(await this.sendInApp(userId, notification, template));
            }
            
            if (preferences.push !== false && (options.channel === undefined || options.channel === 'push')) {
                results.push(await this.sendPush(userId, formattedTitle, formattedMessage, data, template));
            }
            
            if (preferences.email !== false && user.email && (options.channel === undefined || options.channel === 'email')) {
                results.push(await this.sendEmail(user.email, formattedTitle, formattedMessage, data, template));
            }
            
            if (preferences.sms !== false && user.phone && (options.channel === undefined || options.channel === 'sms')) {
                results.push(await this.sendSMS(user.phone, formattedMessage, data));
            }

            // Update notification with delivery status
            await this.updateNotificationStatus(notification.id, results);

            return {
                success: true,
                notificationId: notification.id,
                deliveries: results
            };

        } catch (error) {
            console.error('Send notification error:', error);
            return { success: false, error: error.message };
        }
    }

    async sendBulkNotification(userIds, type, data, options = {}) {
        const results = [];
        
        for (const userId of userIds) {
            const result = await this.sendNotification(userId, type, data, options);
            results.push({ userId, ...result });
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return results;
    }

    async sendToRole(role, type, data, options = {}) {
        const users = await prisma.user.findMany({
            where: { role: role },
            select: { id: true }
        });
        
        const userIds = users.map(u => u.id);
        return this.sendBulkNotification(userIds, type, data, options);
    }

    async sendToArea(area, type, data, options = {}) {
        const users = await prisma.user.findMany({
            where: { address: { contains: area } },
            select: { id: true }
        });
        
        const userIds = users.map(u => u.id);
        return this.sendBulkNotification(userIds, type, data, options);
    }

    // =============================================
    // Specific Notification Types
    // =============================================

    async notifyBinFull(userId, binData) {
        return this.sendNotification(userId, 'bin_full', {
            location: binData.location,
            fillLevel: binData.fillLevel
        });
    }

    async notifyBinNearFull(userId, binData) {
        return this.sendNotification(userId, 'bin_near_full', {
            location: binData.location,
            fillLevel: binData.fillLevel
        });
    }

    async notifyBinIssue(userId, issueData) {
        return this.sendNotification(userId, 'bin_issue', {
            location: issueData.location,
            issue: issueData.issue
        });
    }

    async notifyCollectionScheduled(userId, collectionData) {
        return this.sendNotification(userId, 'collection_scheduled', {
            date: collectionData.date,
            time: collectionData.time
        });
    }

    async notifyCollectionCompleted(userId, collectionData) {
        return this.sendNotification(userId, 'collection_completed', {
            points: collectionData.points
        });
    }

    async notifyCollectionReminder(userId) {
        return this.sendNotification(userId, 'collection_reminder', {});
    }

    async notifyCollectorAssigned(userId, collectorData) {
        return this.sendNotification(userId, 'collector_assigned', {
            collector: collectorData.name
        });
    }

    async notifyPointsEarned(userId, pointsData) {
        return this.sendNotification(userId, 'points_earned', {
            points: pointsData.points,
            reason: pointsData.reason,
            total: pointsData.total
        });
    }

    async notifyTierUpgrade(userId, tierData) {
        return this.sendNotification(userId, 'tier_upgrade', {
            tier: tierData.tier
        });
    }

    async notifyRewardAvailable(userId, rewardData) {
        return this.sendNotification(userId, 'reward_available', {
            rewardName: rewardData.name,
            points: rewardData.points
        });
    }

    async notifyRewardRedeemed(userId, redemptionData) {
        return this.sendNotification(userId, 'reward_redeemed', {
            rewardName: redemptionData.name,
            points: redemptionData.points
        });
    }

    async notifyReportSubmitted(userId, reportData) {
        return this.sendNotification(userId, 'report_submitted', {
            reportId: reportData.id
        });
    }

    async notifyReportUpdated(userId, reportData) {
        return this.sendNotification(userId, 'report_updated', {
            status: reportData.status
        });
    }

    async notifyReportResolved(userId, reportData) {
        return this.sendNotification(userId, 'report_resolved', {
            location: reportData.location
        });
    }

    async notifySystemAlert(userId, message) {
        return this.sendNotification(userId, 'system_alert', {
            message: message
        });
    }

    async notifyEmergency(message, userIds = null) {
        if (userIds) {
            return this.sendBulkNotification(userIds, 'emergency', { message });
        } else {
            return this.sendToRole('ADMIN', 'emergency', { message });
        }
    }

    async notifyMaintenance(date, userIds = null) {
        if (userIds) {
            return this.sendBulkNotification(userIds, 'maintenance', { date });
        } else {
            return this.sendToRole('ADMIN', 'maintenance', { date });
        }
    }

    async notifyPrediction(area, date) {
        const users = await prisma.user.findMany({
            where: { address: { contains: area } },
            select: { id: true }
        });
        
        return this.sendBulkNotification(users.map(u => u.id), 'prediction_alert', {
            area: area,
            date: date
        });
    }

    // =============================================
    // Channel Implementations
    // =============================================

    async sendInApp(userId, notification, template) {
        try {
            // Already saved to database, just emit via WebSocket if available
            if (this.wsManager) {
                this.wsManager.emitToUser(userId, 'notification:new', {
                    id: notification.id,
                    title: notification.title,
                    message: notification.message,
                    type: notification.type,
                    priority: notification.priority,
                    data: notification.data,
                    createdAt: notification.createdAt
                });
            }
            
            return { channel: 'inApp', success: true };
            
        } catch (error) {
            return { channel: 'inApp', success: false, error: error.message };
        }
    }

    async sendPush(userId, title, body, data, template) {
        try {
            // Implementation for push notifications (FCM, APNS, etc.)
            // This would require device tokens stored in the database
            
            const deviceTokens = await this.getDeviceTokens(userId);
            
            if (deviceTokens.length === 0) {
                return { channel: 'push', success: false, error: 'No device tokens' };
            }
            
            // Placeholder for push notification logic
            console.log(`📱 Push to ${userId}: ${title} - ${body}`);
            
            return { channel: 'push', success: true };
            
        } catch (error) {
            return { channel: 'push', success: false, error: error.message };
        }
    }

    async sendEmail(email, subject, body, data, template) {
        try {
            // Implementation for email notifications
            // This would integrate with SendGrid, AWS SES, etc.
            
            console.log(`📧 Email to ${email}: ${subject}`);
            
            return { channel: 'email', success: true };
            
        } catch (error) {
            return { channel: 'email', success: false, error: error.message };
        }
    }

    async sendSMS(phone, message, data) {
        try {
            // Implementation for SMS notifications
            // This would integrate with Twilio, etc.
            
            console.log(`📱 SMS to ${phone}: ${message}`);
            
            return { channel: 'sms', success: true };
            
        } catch (error) {
            return { channel: 'sms', success: false, error: error.message };
        }
    }

    // =============================================
    // Database Operations
    // =============================================

    async createNotificationRecord(userId, type, title, message, data, priority) {
        return await prisma.notification.create({
            data: {
                userId: userId,
                title: title,
                message: message,
                type: type,
                priority: priority,
                data: JSON.stringify(data),
                read: false
            }
        });
    }

    async updateNotificationStatus(notificationId, deliveries) {
        return await prisma.notification.update({
            where: { id: notificationId },
            data: {
                deliveredVia: JSON.stringify(deliveries.filter(d => d.success).map(d => d.channel))
            }
        });
    }

    async markAsRead(userId, notificationId) {
        return await prisma.notification.update({
            where: { id: notificationId, userId: userId },
            data: { read: true }
        });
    }

    async markAllAsRead(userId) {
        return await prisma.notification.updateMany({
            where: { userId: userId, read: false },
            data: { read: true }
        });
    }

    async getNotifications(userId, limit = 50, offset = 0) {
        return await prisma.notification.findMany({
            where: { userId: userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        });
    }

    async getUnreadCount(userId) {
        return await prisma.notification.count({
            where: { userId: userId, read: false }
        });
    }

    async deleteNotification(userId, notificationId) {
        return await prisma.notification.delete({
            where: { id: notificationId, userId: userId }
        });
    }

    async clearAllNotifications(userId) {
        return await prisma.notification.deleteMany({
            where: { userId: userId }
        });
    }

    // =============================================
    // User Preferences
    // =============================================

    async getUserPreferences(userId) {
        const prefs = await prisma.notificationPreference.findUnique({
            where: { userId: userId }
        });
        
        if (prefs) {
            return {
                push: prefs.push,
                email: prefs.email,
                sms: prefs.sms,
                inApp: true,
                binFull: prefs.binFull,
                collectionReminder: prefs.collectionReminder,
                rewardUpdates: prefs.rewardUpdates,
                reportUpdates: prefs.reportUpdates
            };
        }
        
        // Default preferences
        return {
            push: true,
            email: true,
            sms: false,
            inApp: true,
            binFull: true,
            collectionReminder: true,
            rewardUpdates: true,
            reportUpdates: true
        };
    }

    async updateUserPreferences(userId, preferences) {
        return await prisma.notificationPreference.upsert({
            where: { userId: userId },
            update: preferences,
            create: {
                userId: userId,
                ...preferences
            }
        });
    }

    async getDeviceTokens(userId) {
        const tokens = await prisma.pushSubscription.findMany({
            where: { userId: userId },
            select: { endpoint: true }
        });
        
        return tokens.map(t => t.endpoint);
    }

    async saveDeviceToken(userId, token, platform) {
        return await prisma.pushSubscription.upsert({
            where: { endpoint: token },
            update: { userId: userId, platform: platform },
            create: {
                userId: userId,
                endpoint: token,
                keys: JSON.stringify({ platform: platform })
            }
        });
    }

    async removeDeviceToken(userId, token) {
        return await prisma.pushSubscription.deleteMany({
            where: { userId: userId, endpoint: token }
        });
    }

    // =============================================
    // Helper Methods
    // =============================================

    formatMessage(template, data) {
        let message = template;
        for (const [key, value] of Object.entries(data)) {
            message = message.replace(new RegExp(`{${key}}`, 'g'), value);
        }
        return message;
    }

    getChannelStatus(channel) {
        return this.channels[channel] !== false;
    }

    enableChannel(channel) {
        this.channels[channel] = true;
    }

    disableChannel(channel) {
        this.channels[channel] = false;
    }

    setWebSocketManager(wsManager) {
        this.wsManager = wsManager;
    }

    // =============================================
    // Bulk Operations
    // =============================================

    async notifyAllUsers(type, data, options = {}) {
        const users = await prisma.user.findMany({
            select: { id: true }
        });
        
        return this.sendBulkNotification(users.map(u => u.id), type, data, options);
    }

    async notifyActiveUsers(type, data, options = {}) {
        const users = await prisma.user.findMany({
            where: {
                collections: {
                    some: {
                        collectionTime: {
                            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                        }
                    }
                }
            },
            select: { id: true }
        });
        
        return this.sendBulkNotification(users.map(u => u.id), type, data, options);
    }

    // =============================================
    // Analytics
    // =============================================

    async getNotificationStats(userId = null) {
        const where = userId ? { userId: userId } : {};
        
        const [total, read, unread, byType] = await Promise.all([
            prisma.notification.count({ where }),
            prisma.notification.count({ where: { ...where, read: true } }),
            prisma.notification.count({ where: { ...where, read: false } }),
            prisma.notification.groupBy({
                by: ['type'],
                where: where,
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

module.exports = NotificationService;