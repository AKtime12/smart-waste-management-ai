/**
 * Admin Routes
 * Handles admin operations: user management, bin management, analytics
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { 
    validateId,
    validateUserRegistration,
    validateBin,
    validateReward,
    validateDateRange,
    validatePage,
    validateLimit,
    validateSortField,
    validateSearchQuery,
    validateReportStatus,
    sanitizeInput,
    escapeString
} = require('../utils/validators');

// Protect all admin routes - require ADMIN role
router.use(protect);
router.use(authorize('ADMIN'));

// =============================================
// Dashboard & Analytics
// =============================================

// Get dashboard stats
router.get('/dashboard', adminController.getDashboardStats);

// Get analytics with date range validation
router.get('/analytics', async (req, res, next) => {
    try {
        if (req.query.startDate && req.query.endDate) {
            const dateValidation = validateDateRange(req.query.startDate, req.query.endDate);
            if (!dateValidation.valid) {
                return res.status(400).json({ 
                    success: false, 
                    error: dateValidation.error 
                });
            }
        }
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, adminController.getAnalytics);

// =============================================
// User Management
// =============================================

// Get all users with pagination and filters
router.get('/users', async (req, res, next) => {
    try {
        // Validate pagination
        const pageValidation = validatePage(req.query.page);
        const limitValidation = validateLimit(req.query.limit, 100);
        
        req.query.page = pageValidation.value;
        req.query.limit = limitValidation.value;
        
        // Validate sort field
        if (req.query.sort) {
            const sortValidation = validateSortField(req.query.sort, ['createdAt', 'name', 'email', 'points', 'role']);
            if (!sortValidation.valid) {
                return res.status(400).json({ 
                    success: false, 
                    error: sortValidation.error 
                });
            }
            req.query.sort = sortValidation.value;
        }
        
        // Validate search query
        if (req.query.search) {
            const searchValidation = validateSearchQuery(req.query.search);
            if (!searchValidation.valid) {
                return res.status(400).json({ 
                    success: false, 
                    error: searchValidation.error 
                });
            }
            req.query.search = searchValidation.value;
        }
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, adminController.getAllUsers);

// Get single user by ID
router.get('/users/:id', async (req, res, next) => {
    const idValidation = validateId(req.params.id, 'User ID');
    if (!idValidation.valid) {
        return res.status(400).json({ 
            success: false, 
            error: idValidation.error 
        });
    }
    next();
}, adminController.getUser);

// Create new user (admin only)
router.post('/users', async (req, res, next) => {
    try {
        // Validate user data
        const validation = validateUserRegistration(req.body);
        if (!validation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: validation.error 
            });
        }
        
        // Sanitize input
        req.body.name = sanitizeInput(req.body.name);
        req.body.email = sanitizeInput(req.body.email).toLowerCase();
        req.body.address = req.body.address ? sanitizeInput(req.body.address) : null;
        req.body.phone = req.body.phone ? sanitizeInput(req.body.phone) : null;
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, adminController.createUser);

// Update user
router.put('/users/:id', async (req, res, next) => {
    try {
        // Validate ID
        const idValidation = validateId(req.params.id, 'User ID');
        if (!idValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: idValidation.error 
            });
        }
        
        // Sanitize input
        if (req.body.name) {
            req.body.name = sanitizeInput(req.body.name);
            req.body.name = escapeString(req.body.name);
        }
        if (req.body.email) {
            req.body.email = sanitizeInput(req.body.email).toLowerCase();
        }
        if (req.body.address) {
            req.body.address = sanitizeInput(req.body.address);
            req.body.address = escapeString(req.body.address);
        }
        if (req.body.phone) {
            req.body.phone = sanitizeInput(req.body.phone);
        }
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, adminController.updateUser);

// Delete user
router.delete('/users/:id', async (req, res, next) => {
    const idValidation = validateId(req.params.id, 'User ID');
    if (!idValidation.valid) {
        return res.status(400).json({ 
            success: false, 
            error: idValidation.error 
        });
    }
    next();
}, adminController.deleteUser);

// =============================================
// Bin Management
// =============================================

// Get all bins
router.get('/bins', adminController.getAllBins);

// Create new bin
router.post('/bins', async (req, res, next) => {
    try {
        const binValidation = validateBin(req.body);
        if (!binValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: binValidation.error 
            });
        }
        
        // Sanitize text fields
        if (req.body.qrCode) req.body.qrCode = sanitizeInput(req.body.qrCode);
        if (req.body.ward) req.body.ward = sanitizeInput(req.body.ward);
        if (req.body.locality) req.body.locality = sanitizeInput(req.body.locality);
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, adminController.createBin);

// Update bin
router.put('/bins/:id', async (req, res, next) => {
    try {
        const idValidation = validateId(req.params.id, 'Bin ID');
        if (!idValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: idValidation.error 
            });
        }
        
        // Sanitize text fields
        if (req.body.ward) req.body.ward = sanitizeInput(req.body.ward);
        if (req.body.locality) req.body.locality = sanitizeInput(req.body.locality);
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, adminController.updateBin);

// Delete bin
router.delete('/bins/:id', async (req, res, next) => {
    const idValidation = validateId(req.params.id, 'Bin ID');
    if (!idValidation.valid) {
        return res.status(400).json({ 
            success: false, 
            error: idValidation.error 
        });
    }
    next();
}, adminController.deleteBin);

// =============================================
// Collector Management
// =============================================

// Get all collectors
router.get('/collectors', adminController.getCollectors);

// Assign collector to area
router.post('/collectors/:id/assign', async (req, res, next) => {
    try {
        const idValidation = validateId(req.params.id, 'Collector ID');
        if (!idValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: idValidation.error 
            });
        }
        
        if (req.body.area) {
            req.body.area = sanitizeInput(req.body.area);
        }
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, adminController.assignCollector);

// =============================================
// Report Management
// =============================================

// Get all reports with filters
router.get('/reports', async (req, res, next) => {
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
}, adminController.getReports);

// Update report status
router.put('/reports/:id/status', async (req, res, next) => {
    try {
        const idValidation = validateId(req.params.id, 'Report ID');
        if (!idValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: idValidation.error 
            });
        }
        
        const statusValidation = validateReportStatus(req.body.status);
        if (!statusValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: statusValidation.error 
            });
        }
        
        if (req.body.notes) {
            req.body.notes = sanitizeInput(req.body.notes);
        }
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, adminController.updateReportStatus);

// =============================================
// AI Predictions
// =============================================

// Get waste predictions
router.get('/predictions', adminController.getPredictions);

// Get festival predictions
router.get('/predictions/festival', adminController.getFestivalPredictions);

// =============================================
// Reward Management
// =============================================

// Create new reward
router.post('/rewards', async (req, res, next) => {
    try {
        const rewardValidation = validateReward(req.body);
        if (!rewardValidation.valid) {
            return res.status(400).json({ 
                success: false, 
                error: rewardValidation.error 
            });
        }
        
        // Sanitize text fields
        if (req.body.name) req.body.name = sanitizeInput(req.body.name);
        if (req.body.description) req.body.description = sanitizeInput(req.body.description);
        
        next();
    } catch (error) {
        return res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
}, adminController.createReward);

// Get all rewards
router.get('/rewards', adminController.getRewards);

// =============================================
// Analytics
// =============================================

// Get ward analytics
router.get('/wards', adminController.getWardAnalytics);

// Get carbon analytics
router.get('/carbon', adminController.getCarbonAnalytics);

module.exports = router;