const express = require('express');
const router = express.Router();
const { getDirectReferrals } = require('../controllers/referralController');
const { authenticateToken } = require('../controllers/authController');

// My Direct Referral API - Protected with JWT token, userid from token
router.get('/', authenticateToken, getDirectReferrals);

module.exports = router;
