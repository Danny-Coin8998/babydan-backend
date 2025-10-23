const express = require('express');
const router = express.Router();
const { getTeamData } = require('../controllers/teamController');
const { authenticateToken } = require('../controllers/authController');

// My Team API - Protected with JWT token, userid from token
router.get('/', authenticateToken, getTeamData);

module.exports = router; 