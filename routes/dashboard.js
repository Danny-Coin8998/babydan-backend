const express = require('express');
const router = express.Router();
const { getDashboardData } = require('../controllers/dashboardController');
const { authenticateToken } = require('../controllers/authController');

// Dashboard API - Protected with JWT token, userid from token
router.get('/', authenticateToken, getDashboardData);

module.exports = router;
