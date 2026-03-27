// backend/routes/factory.js
const express = require('express');
const router = express.Router();
const factoryController = require('../controllers/factoryController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication and ADMIN (or FACTORY) role
router.use(protect);
router.use(authorize('ADMIN')); // You can add a 'FACTORY' role if you prefer

router.post('/verify', factoryController.verifyWasteAtFactory);
router.get('/pending', factoryController.getPendingVerifications);

module.exports = router;