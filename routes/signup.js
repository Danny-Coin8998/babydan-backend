// routes/signup.js
const express = require('express');
const router = express.Router();
const { signUp, getUserByWallet } = require('../controllers/signupController');

// Create user sign-up
router.post('/', signUp);

module.exports = router;
