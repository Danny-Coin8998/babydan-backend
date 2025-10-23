const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../controllers/authController');
const { buyPackage } = require('../controllers/buyPackageController');

// Buy package with DAN balance (protected)
router.post('/', authenticateToken, buyPackage);

module.exports = router;
