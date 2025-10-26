// controllers/signupController.js
const { getConnection } = require('../config/database');
const bcrypt = require('bcryptjs');
const { mychildrenLastLeft, mychildrenLastRight } = require('./helpers');

// Generate unique referral code
const generateRefCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Generate profile ID (D00001, D00002, etc.)
const generateProfileId = (userid) => {
    return 'D' + userid.toString().padStart(5, '0');
};

// Create user sign-up
const signUp = async (req, res) => {
    try {
        const { ref, side, firstname, lastname, wallet_address } = req.body || {};

        // Validate required parameters
        if (!firstname || !lastname || !wallet_address) {
            return res.status(400).json({
                success: false,
                error: 'firstname, lastname, and wallet_address are required'
            });
        }

        // Validate Ethereum address
        if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid Ethereum wallet address format'
            });
        }

        // Validate side parameter
        if (side && !['left', 'right'].includes(side)) {
            return res.status(400).json({
                success: false,
                error: 'side must be "left" or "right"'
            });
        }

        const connection = await getConnection();
        const conn = await connection.getConnection();

        try {
            await conn.beginTransaction();

            // 1) Check if wallet_address already exists
            const [walletRows] = await conn.execute(
                `SELECT userid FROM members WHERE wallet_address = ?`,
                [wallet_address]
            );

            if (walletRows.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'This wallet address is already registered'
                });
            }

            // 2) Get sponsor info if ref provided
            let sponsorId = 1; // Default sponsor
            if (ref) {
                const [refRows] = await conn.execute(
                    `SELECT userid FROM members WHERE ref_code = ?`,
                    [ref]
                );
                if (refRows.length > 0) {
                    sponsorId = refRows[0].userid;
                }
            }

            // 3) Generate user data
            const refCode = generateRefCode();
            const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const activationCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code

            // 4) Insert user into members table
            const [insertResult] = await conn.execute(
                `INSERT INTO members (
                    username, password, emailaddress, emailaddress_status, firstname, lastname,
                    sponsorid, ip, datecreated, activationcode, wallet_address, ref_code,
                    l_member, r_member, parentid
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    wallet_address, // Use wallet_address as username
                    '', // No password for wallet-based auth
                    '', // No email
                    'VERIFIED', // emailaddress_status
                    firstname,
                    lastname,
                    sponsorId,
                    req.ip || '127.0.0.1',
                    now,
                    activationCode,
                    wallet_address,
                    refCode,
                    side === 'left' ? 1 : 0, // l_member
                    side === 'right' ? 1 : 0, // r_member
                    0 // parentid - will be updated below
                ]
            );

            const userId = insertResult.insertId;

            // 5) Generate profile ID
            const profileId = generateProfileId(userId);
            await conn.execute(
                `UPDATE members SET profileid = ? WHERE userid = ?`,
                [profileId, userId]
            );

            // 6) Set binary tree position (matching legacy PHP logic)
            let parentId = 0;
            
            // Check if manual parent selection is provided
            // if (pid && pid !== 0) {
            //     // Manual parent selection - validate parent exists
            //     const [parentRows] = await conn.execute(
            //         `SELECT userid FROM members WHERE ref_code = ?`,
            //         [pid]
            //     );
            //     if (parentRows.length > 0) {
            //         parentId = parentRows[0].userid;
            //     }
            // } else if (side) {
            // Auto-positioning based on side (recursive like PHP)
            if (side === 'left') {
                parentId = await mychildrenLastLeft(conn, sponsorId);
            } else if (side === 'right') {
                parentId = await mychildrenLastRight(conn, sponsorId);
            }
            // }

            // Update parent ID
            await conn.execute(
                `UPDATE members SET parentid = ? WHERE userid = ?`,
                [parentId, userId]
            );

            await conn.commit();

            return res.json({
                success: true,
                message: 'User registered successfully',
                data: {
                    userid: userId,
                    profileid: profileId,
                    ref_code: refCode,
                    firstname,
                    lastname,
                    wallet_address,
                    sponsor_id: sponsorId,
                    parent_id: parentId,
                    side: side || 'left',
                    activation_code: activationCode,
                    created_at: now
                }
            });

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

    } catch (error) {
        console.error('Sign-up API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    signUp,
};