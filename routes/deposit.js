const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../controllers/authController');
const { createDeposit, getDepositHistory } = require('../controllers/depositController');

// Create deposit (simplified auto-approve)
// router.post('/', authenticateToken, createDeposit);

// Get deposit history
router.get('/', authenticateToken, getDepositHistory);

module.exports = router; 