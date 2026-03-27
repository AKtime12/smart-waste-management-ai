/**
 * Collector Routes
 * Handles collector operations: bin scanning, route optimization, collection history
 */

const express = require('express');
const router = express.Router();
const collectorController = require('../controllers/collectorController');
const { protect, authorize } = require('../middleware/auth');
const { 
    validateId, 
    validateWasteWeight, 
    validateSegregationQuality,
    validateCoordinates,
    sanitizeInput,
    escapeString
} = require('../utils/validators');

// Protect all collector routes - require COLLECTOR role
router.use(protect);
router.use(authorize('COLLECTOR'));

// =============================================
// Get Assigned Bins
// GET /api/collector/bins
// =============================================
router.get('/bins', collectorController.getAssignedBins);

// =============================================
// Get Full Bins (Urgent)
// GET /api/collector/bins/full
// =============================================
router.get('/bins/full', collectorController.getFullBins);

// =============================================
// Scan QR Code (No validation for QR format - allows JSON)
// POST /api/collector/scan
// =============================================
router.post('/scan', collectorController.scanQR);

// =============================================
// Complete Collection
// POST /api/collector/collection/:id/complete
// =============================================
router.post('/collection/:id/complete', async (req, res, next) => {
    try {
        // Validate collection ID
        const idValidation = validateId(req.params.id, 'Collection ID');
        if (!idValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: idValidation.error 
            });
        }
        
        // Validate waste weight if provided
        if (req.body.wasteWeight !== undefined) {
            const weightValidation = validateWasteWeight(req.body.wasteWeight);
            if (!weightValidation.valid) {
                return res.status(400).json({ 
                    success: false, 
                    error: weightValidation.error 
                });
            }
        }
        
        // Validate segregation quality
        if (req.body.segregationQuality) {
            const qualityValidation = validateSegregationQuality(req.body.segregationQuality);
            if (!qualityValidation.valid) {
                return res.status(400).json({ 
                    success: false, 
                    error: qualityValidation.error 
                });
            }
        }
        
        // Sanitize notes
        if (req.body.notes) {
            req.body.notes = sanitizeInput(req.body.notes);
            req.body.notes = escapeString(req.body.notes);
        }
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, collectorController.completeCollection);

// =============================================
// Get Optimized Route
// GET /api/collector/route
// =============================================
router.get('/route', collectorController.getOptimizedRoute);

// =============================================
// Optimize Route (Re-optimize)
// GET /api/collector/route/optimize
// =============================================
router.get('/route/optimize', collectorController.optimizeRoute);

// =============================================
// Get Collection History
// GET /api/collector/history
// =============================================
router.get('/history', collectorController.getCollectionHistory);

// =============================================
// Get Collector Stats
// GET /api/collector/stats
// =============================================
router.get('/stats', collectorController.getCollectorStats);

// =============================================
// Update Current Location (Real-time)
// POST /api/collector/location
// =============================================
router.post('/location', async (req, res, next) => {
    try {
        const { latitude, longitude } = req.body;
        
        // Validate coordinates
        const coordsValidation = validateCoordinates(latitude, longitude);
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
}, collectorController.updateLocation);

module.exports = router;