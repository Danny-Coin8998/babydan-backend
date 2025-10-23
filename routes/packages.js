const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../controllers/authController');
const { getPackages } = require('../controllers/packageController');

// Get enabled packages (public)
router.get('/', authenticateToken, getPackages);

module.exports = router; 