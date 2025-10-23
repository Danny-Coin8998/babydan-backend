const { getConnection } = require('../config/database');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { ethers } = require("ethers");
require('dotenv').config();

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // 7 days

// Generate JWT token
const generateToken = (user) => {
    const payload = {
        userid: user.userid,
        iat: Math.floor(Date.now() / 1000)
    };
    
    return jwt.sign(payload, JWT_SECRET, { 
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'baby-dan-binary-api',
        audience: 'baby-dan-binary-frontend'
    });
};

// Verify JWT token
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};

// Generate nonce for wallet authentication
const generateNonce = () => {
    return crypto.randomBytes(16).toString('hex');
};

// Enhanced address validation function for ethers v6
const isValidEthereumAddress = (address) => {
    try {
        // Check if it's a valid address format
        if (!ethers.isAddress(address)) {
            return false;
        }
        // Additional check: try to get the address (this will throw if invalid)
        ethers.getAddress(address);
        return true;
    } catch (error) {
        return false;
    }
};

// Verify wallet signature
const verifyWalletSignature = async (address, signature, message) => {
    try {
        const recoveredAddress = ethers.verifyMessage(message, signature);
        return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
};

// Get nonce for wallet authentication
const getNonce = async (req, res) => {
    try {
        const { walletAddress } = req.params;
        
        if (!walletAddress) {
            return res.status(400).json({
                success: false,
                error: 'Wallet address is required'
            });
        }

        // Validate wallet address format
        if (!isValidEthereumAddress(walletAddress)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid wallet address format'
            });
        }

        const connection = await getConnection();
        const lowerAddr = walletAddress.toLowerCase();

        // Require existing member; do not auto-create here
        const sql = `SELECT userid FROM members WHERE wallet_address = ? AND status != 2 LIMIT 1`;
        const [rows] = await connection.execute(sql, [lowerAddr]);

        if (!rows || rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Wallet not found. Please sign up first.'
            });
        }

        const userid = rows[0].userid;
        const nonce = generateNonce();

        // Rotate nonce for this user
        const updateSql = `UPDATE members SET nonce = ? WHERE userid = ?`;
        await connection.execute(updateSql, [nonce, userid]);

        return res.json({
            success: true,
            nonce,
            message: `Please sign this message to authenticate: ${nonce}`
        });
    } catch (error) {
        console.error('Nonce generation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate nonce'
        });
    }
};

// Wallet login authentication
const walletLogin = async (req, res) => {
    try {
        const { walletAddress, signature, message } = req.body;

        if (!walletAddress || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'Wallet address, signature, and message are required'
            });
        }

        if (!isValidEthereumAddress(walletAddress)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid wallet address format'
            });
        }

        // Verify the signature
        const isValidSignature = await verifyWalletSignature(walletAddress, signature, message);
        if (!isValidSignature) {
            return res.status(401).json({
                success: false,
                error: 'Invalid wallet signature'
            });
        }

        const connection = await getConnection();

        // Require existing member; do not auto-create
        const sql = `SELECT * FROM members WHERE wallet_address = ? AND status != 2`;
        const [results] = await connection.execute(sql, [walletAddress.toLowerCase()]);

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Wallet not found. Please sign up first.'
            });
        }

        const user = results[0];

        // Update signature and rotate nonce
        const updateSql = `UPDATE members SET wallet_signature = ?, nonce = ? WHERE userid = ?`;
        const newNonce = generateNonce();
        await connection.execute(updateSql, [signature, newNonce, user.userid]);

        // Log the login
        const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
        const ipx = req.headers['x-forwarded-for'] || ip;
        const nowDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

        const logSql = `INSERT INTO members_login_logs (userid, username, ip, ipx, datecreated) VALUES (?, ?, ?, ?, ?)`;
        await connection.execute(logSql, [user.userid, user.wallet_address, ip, ipx, nowDate]);

        // Update last login date
        const updateLoginSql = `UPDATE members SET lastlogindate = ? WHERE userid = ?`;
        await connection.execute(updateLoginSql, [nowDate, user.userid]);

        // Generate JWT token
        const token = generateToken(user);

        res.json({
            success: true,
            message: 'Wallet authentication successful',
            token: token,
            user: {
                userid: user.userid,
                wallet_address: user.wallet_address
            }
        });

    } catch (error) {
        console.error('Wallet login error:', error);
        res.status(500).json({
            success: false,
            error: 'Wallet authentication failed'
        });
    }
};

// OLD LOGIN FUNCTION - COMMENTED OUT

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password are required'
            });
        }

        // Sanitize username
        const sanitizedUsername = username.replace(/[ ']/g, '');

        // Hash password using MD5 (matching PHP implementation)
        const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

        // Get database connection
        const connection = await getConnection();

        // Check user credentials
        const sql = `SELECT * FROM members 
                     WHERE username = ? AND password = ? AND status != 2 
                     ORDER BY userid ASC LIMIT 1`;
        
        const [results] = await connection.execute(sql, [sanitizedUsername, hashedPassword]);

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Username or Password is incorrect. Please try again'
            });
        }

        const user = results[0];

        // Get client IP
        const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
        const ipx = req.headers['x-forwarded-for'] || ip;
        const nowDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Log login attempt
        const logSql = `INSERT INTO members_login_logs 
                        (userid, username, ip, ipx, datecreated) 
                        VALUES (?, ?, ?, ?, ?)`;
        
        await connection.execute(logSql, [
            user.userid,
            sanitizedUsername,
            ip,
            ipx,
            nowDate
        ]);

        // Update last login date
        const updateSql = `UPDATE members 
                           SET lastlogindate = ? 
                           WHERE userid = ?`;
        
        await connection.execute(updateSql, [nowDate, user.userid]);

        // Generate JWT token
        const token = generateToken(user);

        // Return success response with only token
        res.json({
            success: true,
            message: 'Login successful',
            token: token
        });

    } catch (error) {
        console.error('Login API error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};


// Logout function
const logout = async (req, res) => {
    try {
        // In a real implementation, you might want to:
        // 1. Add token to blacklist
        // 2. Log the logout event
        // 3. Clear any server-side session data

        res.json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Logout API error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
};

// Verify token middleware
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Access token required'
            });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(403).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }

        // Verify user still exists and is active
        const connection = await getConnection();
        const sql = `SELECT userid, wallet_address, firstname, ref_code, status 
                     FROM members 
                     WHERE userid = ? AND status != 2`;
        
        const [results] = await connection.execute(sql, [decoded.userid]);

        if (results.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'User not found or inactive'
            });
        }

        req.user = results[0];
        next();
    } catch (error) {
        console.error('Token verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Token verification failed'
        });
    }
};

// Check if user is authenticated (legacy middleware for userid params)
const authenticate = async (req, res, next) => {
    try {
        const { userid } = req.params;
        
        if (!userid) {
            return res.status(401).json({
                success: false,
                error: 'User ID is required'
            });
        }

        // Verify user exists and is active
        const connection = await getConnection();
        const sql = `SELECT userid, wallet_address, firstname, ref_code, status 
                     FROM members 
                     WHERE userid = ? AND status != 2`;
        
        const [results] = await connection.execute(sql, [userid]);

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'User not found or inactive'
            });
        }

        req.user = results[0];
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

// Refresh token endpoint
const refreshToken = async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Refresh token required'
            });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(403).json({
                success: false,
                error: 'Invalid refresh token'
            });
        }

        // Get fresh user data
        const connection = await getConnection();
        const sql = `SELECT * FROM members WHERE userid = ? AND status != 2`;
        const [results] = await connection.execute(sql, [decoded.userid]);

        if (results.length === 0) {
            return res.status(403).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = results[0];
        const newToken = generateToken(user);

        res.json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                token: newToken,
                tokenType: 'Bearer',
                expiresIn: JWT_EXPIRES_IN
            }
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Token refresh failed'
        });
    }
};

module.exports = {
    login, // Commented out - using wallet authentication
    getNonce,
    walletLogin,
    logout,
    authenticate,
    authenticateToken,
    refreshToken,
    generateToken,
    verifyToken
};
