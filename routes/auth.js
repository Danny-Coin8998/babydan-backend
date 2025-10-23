const express = require('express');
const router = express.Router();
const { 
    // login, // Commented out - using wallet authentication
    getNonce,
    walletLogin,
    logout, 
    authenticate, 
    authenticateToken, 
    refreshToken 
} = require('../controllers/authController');
const { signUp } = require('../controllers/signupController');

// OLD LOGIN ROUTE - COMMENTED OUT
// router.post('/login', login);

// New wallet authentication routes
router.get('/nonce/:walletAddress', getNonce);
router.post('/wallet-login', walletLogin);

// User sign-up
router.post('/sign-up', signUp);

// Other auth routes
router.post('/logout', logout);
router.post('/refresh', refreshToken);

// Add the missing verify endpoint
router.get('/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: 'Token is valid',
        user: req.user
    });
});

module.exports = router;