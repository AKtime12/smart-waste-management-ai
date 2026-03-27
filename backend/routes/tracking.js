/**
 * Tracking Routes
 * Handles real-time tracking of bins, collectors, and waste
 */

const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { protect } = require('../middleware/auth');
const { validateId, validateCoordinates } = require('../utils/validators');

// Protect all tracking routes
router.use(protect);

// =============================================
// Get Bin Status
// GET /api/tracking/bins
// =============================================
router.get('/bins', trackingController.getBinStatus);

// =============================================
// Get Active Collectors
// GET /api/tracking/collectors
// =============================================
router.get('/collectors', trackingController.getActiveCollectors);

// =============================================
// Get Live Stats
// GET /api/tracking/stats
// =============================================
router.get('/stats', trackingController.getLiveStats);

// =============================================
// Get Collector Route
// GET /api/tracking/route/:collectorId
// =============================================
router.get('/route/:collectorId', async (req, res, next) => {
    const idValidation = validateId(req.params.collectorId, 'Collector ID');
    if (!idValidation.valid) {
        return res.status(400).json({ 
            success: false, 
            error: idValidation.error 
        });
    }
    next();
}, trackingController.getCollectorRoute);

// =============================================
// Update Collector Location
// POST /api/tracking/location/update
// =============================================
router.post('/location/update', async (req, res, next) => {
    try {
        const { lat, lng } = req.body;
        
        if (lat === undefined || lng === undefined) {
            return res.status(400).json({ 
                success: false, 
                error: 'Latitude and longitude are required' 
            });
        }
        
        // Validate coordinates
        const coordsValidation = validateCoordinates(lat, lng);
        if (!coordsValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: coordsValidation.error 
            });
        }
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, trackingController.updateCollectorLocation);

// =============================================
// Get Bin History
// GET /api/tracking/history/:binId
// =============================================
router.get('/history/:binId', async (req, res, next) => {
    const idValidation = validateId(req.params.binId, 'Bin ID');
    if (!idValidation.valid) {
        return res.status(400).json({ 
            success: false, 
            error: idValidation.error 
        });
    }
    next();
}, trackingController.getBinHistory);

module.exports = router;