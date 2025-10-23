const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../controllers/authController');
const { getBalance } = require('../controllers/walletController');

// Get DAN balance for authenticated user
router.get('/', authenticateToken, getBalance);

module.exports = router; 