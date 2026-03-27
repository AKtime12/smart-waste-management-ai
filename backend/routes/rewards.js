const express = require('express');
const router = express.Router();
const rewardsController = require('../controllers/rewardsController');
const { protect } = require('../middleware/auth');

// Protect all routes
router.use(protect);

// Get ward stats
router.get('/wards', rewardsController.getWardStats);

// Get points leaderboard
router.get('/points/leaderboard', rewardsController.getLeaderboard);

module.exports = router;
