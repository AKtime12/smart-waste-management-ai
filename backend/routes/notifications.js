/**
 * Notifications Routes
 * Handles user notifications and preferences
 */

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { validateId, sanitizeInput } = require('../utils/validators');

// Protect all notification routes
router.use(protect);

// =============================================
// Get User Notifications
// GET /api/notifications
// =============================================
router.get('/', notificationController.getNotifications);

// =============================================
// Mark Notification as Read
// PUT /api/notifications/:id/read
// =============================================
router.put('/:id/read', async (req, res, next) => {
    const idValidation = validateId(req.params.id, 'Notification ID');
    if (!idValidation.valid) {
        return res.status(400).json({ 
            success: false, 
            error: idValidation.error 
        });
    }
    next();
}, notificationController.markAsRead);

// =============================================
// Mark All Notifications as Read
// PUT /api/notifications/read-all
// =============================================
router.put('/read-all', notificationController.markAllAsRead);

// =============================================
// Delete Notification
// DELETE /api/notifications/:id
// =============================================
router.delete('/:id', async (req, res, next) => {
    const idValidation = validateId(req.params.id, 'Notification ID');
    if (!idValidation.valid) {
        return res.status(400).json({ 
            success: false, 
            error: idValidation.error 
        });
    }
    next();
}, notificationController.deleteNotification);

// =============================================
// Get Notification Preferences
// GET /api/notifications/preferences
// =============================================
router.get('/preferences', notificationController.getPreferences);

// =============================================
// Update Notification Preferences
// PUT /api/notifications/preferences
// =============================================
router.put('/preferences', async (req, res, next) => {
    try {
        // Validate boolean fields
        const booleanFields = ['email', 'push', 'sms', 'binFull', 'collectionReminder', 'rewardUpdates', 'reportUpdates'];
        
        for (const field of booleanFields) {
            if (req.body[field] !== undefined) {
                req.body[field] = Boolean(req.body[field]);
            }
        }
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, notificationController.updatePreferences);

// =============================================
// Subscribe to Push Notifications
// POST /api/notifications/subscribe
// =============================================
router.post('/subscribe', async (req, res, next) => {
    try {
        const { subscription } = req.body;
        
        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ 
                success: false, 
                error: 'Valid subscription data is required' 
            });
        }
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, notificationController.subscribePush);

// =============================================
// Unsubscribe from Push Notifications
// POST /api/notifications/unsubscribe
// =============================================
router.post('/unsubscribe', async (req, res, next) => {
    try {
        const { endpoint } = req.body;
        
        if (!endpoint) {
            return res.status(400).json({ 
                success: false, 
                error: 'Endpoint is required' 
            });
        }
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, notificationController.unsubscribePush);

module.exports = router;