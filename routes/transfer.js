// routes/transfer.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../controllers/authController');
const { createTransfer } = require('../controllers/transferController');

// Create transfer (auto-approve, no OTP)
router.post('/', authenticateToken, createTransfer);

module.exports = router; 