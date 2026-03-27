const { prisma } = require('../database/db');

exports.getNotifications = async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 50
        });
        
        res.json(notifications);
        
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to get notifications' });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const notification = await prisma.notification.update({
            where: {
                id: req.params.id,
                userId: req.user.id
            },
            data: { read: true }
        });
        
        res.json({ success: true, notification });
        
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ error: 'Failed to mark notification' });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: {
                userId: req.user.id,
                read: false
            },
            data: { read: true }
        });
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Mark all as read error:', error);
        res.status(500).json({ error: 'Failed to mark notifications' });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        await prisma.notification.delete({
            where: {
                id: req.params.id,
                userId: req.user.id
            }
        });
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
};

exports.getPreferences = async (req, res) => {
    try {
        let preferences = await prisma.notificationPreference.findUnique({
            where: { userId: req.user.id }
        });
        
        if (!preferences) {
            preferences = {
                email: true,
                push: true,
                sms: false,
                binFull: true,
                collectionReminder: true,
                rewardUpdates: true
            };
        }
        
        res.json(preferences);
        
    } catch (error) {
        console.error('Get preferences error:', error);
        res.status(500).json({ error: 'Failed to get preferences' });
    }
};

exports.updatePreferences = async (req, res) => {
    try {
        const preferences = await prisma.notificationPreference.upsert({
            where: { userId: req.user.id },
            update: req.body,
            create: {
                userId: req.user.id,
                ...req.body
            }
        });
        
        res.json({ success: true, preferences });
        
    } catch (error) {
        console.error('Update preferences error:', error);
        res.status(500).json({ error: 'Failed to update preferences' });
    }
};

exports.subscribePush = async (req, res) => {
    try {
        const { subscription } = req.body;
        
        await prisma.pushSubscription.upsert({
            where: {
                userId_endpoint: {
                    userId: req.user.id,
                    endpoint: subscription.endpoint
                }
            },
            update: subscription,
            create: {
                userId: req.user.id,
                endpoint: subscription.endpoint,
                keys: subscription.keys
            }
        });
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Subscribe push error:', error);
        res.status(500).json({ error: 'Failed to subscribe' });
    }
};

exports.unsubscribePush = async (req, res) => {
    try {
        const { endpoint } = req.body;
        
        await prisma.pushSubscription.deleteMany({
            where: {
                userId: req.user.id,
                endpoint
            }
        });
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Unsubscribe push error:', error);
        res.status(500).json({ error: 'Failed to unsubscribe' });
    }
};