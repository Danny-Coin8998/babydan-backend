const { getConnection } = require('../config/database');
const { getDanPriceUsd, getSponsorId, referralBonus, pvAdd, settleBinaryForUser } = require('./helpers');

const buyPackage = async (req, res) => {
    try {
        // Note: Balance check and deduction handled on frontend
        const { userid } = req.user;
        const { p_id, isAdminAction } = req.body || {};

        if (!p_id) {
            return res.status(400).json({ success: false, error: 'p_id is required' });
        }

        const connection = await getConnection();

        // 1) Load package
        const [pkgRows] = await connection.execute(
            `SELECT p_id, p_name, p_percent, p_period, p_amount FROM packages WHERE is_enabled = 'YES' AND p_id = ? LIMIT 1`,
            [p_id]
        );
        if (!pkgRows || pkgRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Package not found or disabled' });
        }
        const pkg = pkgRows[0];
        const usdtAmount = Number(pkg.p_amount);

        // 2) Fetch DAN price (balance check handled on frontend)
        const danPrice = await getDanPriceUsd();
        if (!danPrice || danPrice <= 0) {
            return res.status(503).json({ success: false, error: 'Cannot load BABY DAN price' });
        }
        const requiredDan = +(usdtAmount / danPrice).toFixed(6);
        
        // Balance check and deduction removed - handled on frontend
        // const danBalance = await getDanBalance(userid);
        // if (danBalance < requiredDan) {
        //     return res.status(400).json({
        //         success: false,
        //         error: 'Insufficient BABY DAN balance',
        //         data: { required_baby_dan: requiredDan, baby_dan_balance: danBalance, dan_price: danPrice }
        //     });
        // }

        // 3) Build timestamps
        const now = new Date();
        const nowSql = now.toISOString().slice(0, 19).replace('T', ' ');
        const nextDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 19)
            .replace('T', ' ');

        // 4) Begin transaction
        const conn = await connection.getConnection();
        try {
            await conn.beginTransaction();

            // 4.1) DAN deduction removed - handled on frontend
            // const [txnRes] = await conn.execute(
            //     `INSERT INTO wallet_cash_transactions (
            //         userid, tran_type, coin_name, in_amount, out_amount, vat_amount, fee_amount, detail,
            //         created_datetime, admin_username, admin_status, admin_datetime, admin_msg
            //      ) VALUES (?, 'Invest', 'DAN', 0.00, ?, 0.00, 0.00, ?, ?, 'System', 'APPROVED', ?, 'Buy package by BABY DAN')`,
            //     [userid, requiredDan, `Package ID: ${pkg.p_id}`, nowSql, nowSql]
            // );

            // 4.2) Create member_invest row
            const txnDetail = isAdminAction 
                ? `Admin Action - By BABY DAN (${usdtAmount} USDT)`
                : `By BABY DAN (${usdtAmount} USDT)`;
            
            const [invRes] = await conn.execute(
                `INSERT INTO member_invest (
                    userid, p_id, inv_date, inv_amount, roi_next_datetime, txn, status
                 ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
                [userid, pkg.p_id, nowSql, requiredDan, nextDate, txnDetail]
            );

            // 4.3) Referral bonus (10%) and PV propagation
            const [userRows] = await conn.execute(`SELECT username FROM members WHERE userid = ?`, [userid]);
            const fromUsername = userRows?.[0]?.username || 'User';
            const sponsorId = await getSponsorId(conn, userid);
            if (sponsorId > 0) {
                await referralBonus(conn, sponsorId, fromUsername, 1, requiredDan);
            }
            await pvAdd(conn, userid, requiredDan, 0, userid);

            // 4.4) Immediate binary settlement for this user (pass sponsorId to avoid duplicate query)
            await settleBinaryForUser(conn, userid, sponsorId);

            await conn.commit();

            return res.json({
                success: true,
                data: {
                    userid,
                    package: {
                        p_id: pkg.p_id,
                        p_name: pkg.p_name,
                        p_percent: Number(pkg.p_percent),
                        p_period: pkg.p_period,
                        amount_usdt: usdtAmount
                    },
                    investment: {
                        inv_id: invRes.insertId,
                        // inv_amount_dan: requiredDan,
                        roi_next_datetime: nextDate,
                        txn: `By BABY DAN (${usdtAmount} USDT)`,
                        status: 'ACTIVE'
                    },
                    // ledger: {
                    //     transaction_id: txnRes.insertId,
                    //     tran_type: 'Invest',
                    //     coin_name: 'DAN',
                    //     out_amount: requiredDan
                    // },
                    // dan_price: danPrice
                    // user_baby_dan_balance_before: danBalance,
                    // user_baby_dan_balance_after: +(danBalance - requiredDan).toFixed(6)
                }
            });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (error) {
        console.error('Buy Package API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { buyPackage };
