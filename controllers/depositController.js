// controllers/depositController.js
const { getConnection } = require('../config/database');

// BSC transaction hash validation
const isValidBscTxHash = (txHash) => {
    return /^0x[a-fA-F0-9]{64}$/.test(txHash);
};

const createDeposit = async (req, res) => {
    try {
        const { userid } = req.user;
        const { baby_dan_amount, txn_hash } = req.body || {};

        // Validate parameters
        if (!baby_dan_amount || !txn_hash) {
            return res.status(400).json({ 
                success: false, 
                error: 'baby_dan_amount and txn_hash are required' 
            });
        }

        if (!isValidBscTxHash(txn_hash)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid transaction hash format' 
            });
        }

        const danAmount = parseFloat(baby_dan_amount);
        if (isNaN(danAmount) || danAmount <= 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'baby_dan_amount must be a positive number' 
            });
        }

        const connection = await getConnection();

        // Check duplicate hash
        const [duplicateRows] = await connection.execute(
            `SELECT d_id FROM deposits WHERE txn_hash = ?`, 
            [txn_hash]
        );
        
        if (duplicateRows.length > 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'This hash is already in system' 
            });
        }

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const conn = await connection.getConnection();

        try {
            await conn.beginTransaction();

            // Insert into deposits table (simplified)
            const [depositResult] = await conn.execute(
                `INSERT INTO deposits (userid, txn_hash, created_datetime, status) VALUES (?, ?, ?, ?)`,
                [userid, txn_hash, now, 'APPROVED']
            );

            // Insert into wallet_cash_transactions (for balance)
            const [txnResult] = await conn.execute(
                `INSERT INTO wallet_cash_transactions (
                    userid, tran_type, coin_name, in_amount, out_amount, 
                    vat_amount, fee_amount, detail, created_datetime, 
                    admin_username, admin_status, admin_datetime, admin_msg, is_show
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userid, 'Deposit', 'DAN', danAmount, 0.00, 0.00, 0.00,
                    `Deposit TX: ${txn_hash}`, now, 'System', 'APPROVED', now, 
                    'Auto-approved deposit', 'YES'
                ]
            );

            await conn.commit();

            return res.json({
                success: true,
                message: 'Deposit processed successfully',
                data: {
                    userid,
                    baby_dan_amount: danAmount,
                    txn_hash,
                    deposit: {
                        d_id: depositResult.insertId,
                        status: 'APPROVED',
                        created_at: now
                    },
                    transaction: {
                        t_id: txnResult.insertId,
                        tran_type: 'Deposit',
                        coin_name: 'DAN',
                        in_amount: danAmount
                    }
                }
            });

        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

    } catch (error) {
        console.error('Create Deposit API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get deposit history
const getDepositHistory = async (req, res) => {
    try {
        const { userid } = req.user;
        const connection = await getConnection();
        
        const [rows] = await connection.execute(
            `SELECT d.*, w.in_amount, w.created_datetime as txn_created 
             FROM deposits d 
             LEFT JOIN wallet_cash_transactions w ON d.txn_hash = w.detail 
             WHERE d.userid = ? 
             ORDER BY d.created_datetime DESC`,
            [userid]
        );

        res.json({
            success: true,
            data: {
                deposits: rows,
                total_count: rows.length
            }
        });

    } catch (error) {
        console.error('Get Deposit History API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    createDeposit,
    getDepositHistory
};