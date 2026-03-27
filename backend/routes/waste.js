const express = require('express');
const router = express.Router();
const wasteController = require('../controllers/wasteController');
const { protect } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Get collections
router.get('/collections', wasteController.getCollections);

// Get user stats
router.get('/stats', wasteController.getUserStats);

// Get tips
router.get('/tips', wasteController.getTips);

module.exports = router;
