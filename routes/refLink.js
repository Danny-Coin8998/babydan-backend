const express = require('express');
const router = express.Router();
const { getReferralLinks } = require('../controllers/refLinkController');
const { authenticateToken } = require('../controllers/authController');

// Referral Link API - Protected with JWT token, userid from token
router.get('/', authenticateToken, getReferralLinks);

module.exports = router; 