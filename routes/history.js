const express = require('express');
const router = express.Router();
const { getHistoryData } = require('../controllers/historyController');
const { authenticateToken } = require('../controllers/authController');

// History API - Protected with JWT token, userid from token
router.get('/', authenticateToken, getHistoryData);

module.exports = router;
