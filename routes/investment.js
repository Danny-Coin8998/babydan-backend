const express = require('express');
const router = express.Router();
const { getInvestmentData } = require('../controllers/investmentController');
const { authenticateToken } = require('../controllers/authController');

// My Investment API - Protected with JWT token, userid from token
router.get('/', authenticateToken, getInvestmentData);

module.exports = router;
