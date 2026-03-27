/**
 * Report Routes
 * Handles waste reporting and issue tracking
 */

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { 
    validateReport, 
    validateId, 
    validateReportStatus,
    validateCoordinates,
    validatePage,
    validateLimit,
    sanitizeInput,
    escapeString
} = require('../utils/validators');

// Protect all report routes
router.use(protect);

// =============================================
// Submit New Report
// POST /api/report/submit
// =============================================
router.post('/submit', upload.single('photo'), async (req, res, next) => {
    try {
        // Parse coordinates if they come as strings
        let latitude = req.body.latitude;
        let longitude = req.body.longitude;
        
        if (typeof latitude === 'string') latitude = parseFloat(latitude);
        if (typeof longitude === 'string') longitude = parseFloat(longitude);
        
        // Validate report data
        const reportValidation = validateReport({
            description: req.body.description,
            latitude: latitude,
            longitude: longitude,
            type: req.body.type
        });
        
        if (!reportValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: reportValidation.error 
            });
        }
        
        // Sanitize description
        req.body.description = sanitizeInput(req.body.description);
        req.body.description = escapeString(req.body.description);
        req.body.latitude = latitude;
        req.body.longitude = longitude;
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, reportController.submitReport);

// =============================================
// Get All Reports (with filters)
// GET /api/report
// =============================================
router.get('/', async (req, res, next) => {
    try {
        // Validate status if provided
        if (req.query.status) {
            const statusValidation = validateReportStatus(req.query.status);
            if (!statusValidation.valid) {
                return res.status(400).json({ 
                    success: false, 
                    error: statusValidation.error 
                });
            }
        }
        
        // Validate pagination
        const pageValidation = validatePage(req.query.page);
        const limitValidation = validateLimit(req.query.limit, 100);
        
        req.query.page = pageValidation.value;
        req.query.limit = limitValidation.value;
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, reportController.getReports);

// =============================================
// Get Nearby Reports
// GET /api/report/nearby
// =============================================
router.get('/nearby', async (req, res, next) => {
    try {
        const { lat, lng, radius } = req.query;
        
        if (!lat || !lng) {
            return res.status(400).json({ 
                success: false, 
                error: 'Latitude and longitude are required' 
            });
        }
        
        // Validate coordinates
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lng);
        
        const coordsValidation = validateCoordinates(latNum, lngNum);
        if (!coordsValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: coordsValidation.error 
            });
        }
        
        req.query.lat = latNum;
        req.query.lng = lngNum;
        req.query.radius = radius ? parseFloat(radius) : 2;
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, reportController.getNearbyReports);

// =============================================
// Get Single Report by ID
// GET /api/report/:id
// =============================================
router.get('/:id', async (req, res, next) => {
    const idValidation = validateId(req.params.id, 'Report ID');
    if (!idValidation.valid) {
        return res.status(400).json({ 
            success: false, 
            error: idValidation.error 
        });
    }
    next();
}, reportController.getReportById);

// =============================================
// Update Report Status
// PUT /api/report/:id/status
// =============================================
router.put('/:id/status', async (req, res, next) => {
    try {
        // Validate ID
        const idValidation = validateId(req.params.id, 'Report ID');
        if (!idValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: idValidation.error 
            });
        }
        
        // Validate status
        const statusValidation = validateReportStatus(req.body.status);
        if (!statusValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: statusValidation.error 
            });
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
}, reportController.updateReportStatus);

// =============================================
// Get My Reports
// GET /api/report/my
// =============================================
router.get('/my', reportController.getMyReports);

module.exports = router;