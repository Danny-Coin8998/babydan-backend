// routes/withdraw.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../controllers/authController');
const { createWithdraw, getWithdrawHistory, preWithdrawCheck } = require('../controllers/withdrawController');

// Create withdraw (auto-approve)
router.post('/', authenticateToken, createWithdraw);

// Pre-withdraw check (no side effects)
router.post('/pre', authenticateToken, preWithdrawCheck);

// Get withdraw history
router.get('/', authenticateToken, getWithdrawHistory);

module.exports = router;
