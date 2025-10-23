// controllers/withdrawController.js
const { getConnection } = require('../config/database');
const { getDanBalance } = require('./helpers');

// BSC transaction hash validation
const isValidBscTxHash = (txHash) => {
    return /^0x[a-fA-F0-9]{64}$/.test(txHash);
};

// Create withdraw (simplified auto-approve)
const createWithdraw = async (req, res) => {
    try {
        const { userid } = req.user;
        const { baby_dan_amount, txn_hash } = req.body || {};

        // Validate required parameters
        if (!baby_dan_amount || !txn_hash) {
            return res.status(400).json({
                success: false,
                error: 'baby_dan_amount and txn_hash are required'
            });
        }

        // Validate BSC transaction hash format
        if (!isValidBscTxHash(txn_hash)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid transaction hash format'
            });
        }

        // Validate baby_dan_amount is positive number
        const danAmount = parseFloat(baby_dan_amount);
        if (isNaN(danAmount) || danAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'baby_dan_amount must be a positive number'
            });
        }

        const connection = await getConnection();

        // Check for duplicate transaction hash
        const [duplicateRows] = await connection.execute(
            `SELECT t_id FROM wallet_cash_transactions WHERE detail LIKE ? AND tran_type = 'Withdraw'`,
            [`%${txn_hash}%`]
        );
        
        if (duplicateRows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'This transaction hash is already used'
            });
        }

        // Check user balance
        const [balanceRows] = await connection.execute(
            `SELECT 
                COALESCE(SUM(CASE WHEN admin_status = 'APPROVED' THEN in_amount ELSE 0 END), 0) - 
                COALESCE(SUM(CASE WHEN admin_status = 'APPROVED' THEN out_amount ELSE 0 END), 0) as balance
             FROM wallet_cash_transactions 
             WHERE userid = ?`,
            [userid]
        );

        const userBalance = parseFloat(balanceRows[0].balance);

        if (userBalance < danAmount) {
            return res.status(400).json({
                success: false,
                error: 'Insufficient balance',
                data: {
                    required_amount: danAmount,
                    current_balance: userBalance,
                    shortfall: danAmount - userBalance
                }
            });
        }

        // Enforce 24-hour withdrawal cap (10,000 DAN)
        const WITHDRAW_24H_LIMIT = 10000;
        const [sumRows] = await connection.execute(
            `SELECT COALESCE(SUM(out_amount), 0) AS total_withdraw_24h
             FROM wallet_cash_transactions
             WHERE tran_type = 'Withdraw'
               AND userid = ?
               AND created_datetime >= DATE_ADD(NOW(), INTERVAL 7 HOUR) - INTERVAL 24 HOUR`,
            [userid]
        );
        const totalWithdrawLast24h = parseFloat(sumRows[0].total_withdraw_24h) || 0;
        const projectedTotal = totalWithdrawLast24h + danAmount;
        if (projectedTotal > WITHDRAW_24H_LIMIT) {
            const remaining = Math.max(0, WITHDRAW_24H_LIMIT - totalWithdrawLast24h);
            return res.status(400).json({
                success: false,
                error: '24-hour withdrawal limit exceeded',
                data: {
                    limit_24h: WITHDRAW_24H_LIMIT,
                    used_last_24h: totalWithdrawLast24h,
                    attempted: danAmount,
                    remaining_allowance: remaining
                }
            });
        }

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const conn = await connection.getConnection();

        try {
            await conn.beginTransaction();

            // Insert withdraw transaction (auto-approved)
            const [txnResult] = await conn.execute(
                `INSERT INTO wallet_cash_transactions (
                    userid, tran_type, coin_name, in_amount, out_amount, 
                    vat_amount, fee_amount, detail, created_datetime, 
                    admin_username, admin_status, admin_datetime, admin_msg, is_show,
                    admin_withdraw_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userid, 'Withdraw', 'DAN', 0.00, danAmount, 0.00, 0.00,
                    `Withdraw TX: ${txn_hash}`, now, 'System', 'APPROVED', now, 
                    'Auto-approved withdraw', 'YES', 'APPROVED'
                ]
            );

            await conn.commit();

            return res.json({
                success: true,
                message: 'Withdraw processed successfully',
                data: {
                    userid,
                    baby_dan_amount: danAmount,
                    txn_hash,
                    transaction: {
                        t_id: txnResult.insertId,
                        tran_type: 'Withdraw',
                        coin_name: 'DAN',
                        out_amount: danAmount,
                        status: 'APPROVED',
                        created_at: now
                    },
                    balance: {
                        before: userBalance,
                        after: userBalance - danAmount
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
        console.error('Create Withdraw API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Pre-withdraw check (no side effects)
const preWithdrawCheck = async (req, res) => {
    try {
        const { userid } = req.user;
        const { baby_dan_amount } = req.body || {};

        if (!baby_dan_amount) {
            return res.status(400).json({
                success: false,
                error: 'baby_dan_amount is required'
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
        const WITHDRAW_24H_LIMIT = 10000;
        const [[{ total_withdraw_24h }]] = await connection.execute(
            `SELECT COALESCE(SUM(out_amount), 0) AS total_withdraw_24h
             FROM wallet_cash_transactions
             WHERE tran_type = 'Withdraw'
               AND userid = ?
               AND created_datetime >= DATE_ADD(NOW(), INTERVAL 7 HOUR) - INTERVAL 24 HOUR`,
            [userid]
        );
        const used = Number(total_withdraw_24h) || 0;
        const remaining = Math.max(0, WITHDRAW_24H_LIMIT - used);

        // Compute approved balance via helper
        const userBalance = await getDanBalance(userid);

        const allowedByCap = danAmount <= remaining;
        const allowedByBalance = danAmount <= userBalance;
        const canWithdraw = allowedByCap && allowedByBalance;
        // explicit override (redundant but clear)
        const finalCanWithdraw = allowedByBalance ? canWithdraw : false;

        return res.json({
            success: true,
            data: {
                can_withdraw: finalCanWithdraw,
                attempted: danAmount,
                limit_24h: WITHDRAW_24H_LIMIT,
                used_last_24h: used,
                remaining_allowance: remaining,
                projected_total: used + danAmount,
                balance: {
                    current: userBalance,
                    after: userBalance - danAmount,
                    insufficient: !allowedByBalance,
                    shortfall: allowedByBalance ? 0 : (danAmount - userBalance)
                },
                cap: {
                    exceeded: !allowedByCap
                }
            }
        });
    } catch (error) {
        console.error('Pre Withdraw Check API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// Get withdraw history
const getWithdrawHistory = async (req, res) => {
    try {
        const { userid } = req.user;
        const connection = await getConnection();
        
        const [rows] = await connection.execute(
            `SELECT t_id, tran_type, coin_name, out_amount, fee_amount, 
                    detail, created_datetime, admin_status, admin_withdraw_status
             FROM wallet_cash_transactions 
             WHERE userid = ? AND tran_type = 'Withdraw' 
             ORDER BY created_datetime DESC`,
            [userid]
        );

        res.json({
            success: true,
            data: {
                withdrawals: rows.map(withdraw => ({
                    t_id: withdraw.t_id,
                    tran_type: withdraw.tran_type,
                    coin_name: withdraw.coin_name,
                    out_amount: withdraw.out_amount,
                    fee_amount: withdraw.fee_amount,
                    net_amount: withdraw.out_amount - withdraw.fee_amount,
                    txn_hash: withdraw.detail.replace('Withdraw TX: ', ''),
                    status: withdraw.admin_withdraw_status || withdraw.admin_status,
                    created_at: withdraw.created_datetime
                })),
                total_count: rows.length
            }
        });

    } catch (error) {
        console.error('Get Withdraw History API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    createWithdraw,
    preWithdrawCheck,
    getWithdrawHistory,
};
