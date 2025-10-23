const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../controllers/authController');
const { updateName, getProfile } = require('../controllers/profileController');

// Get user profile (protected)
router.get('/', authenticateToken, getProfile);

// Update fullname (protected)
router.put('/fullname', authenticateToken, updateName);

module.exports = router;
