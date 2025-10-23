const { getConnection } = require('../config/database');

// Helper functions (converted from PHP functions)
const getDanBalance = async (userid) => {
    try {
        const connection = await getConnection();
        const sql = `SELECT 
                        SUM(in_amount) as amt_in, 
                        SUM(out_amount) as amt_out 
                    FROM wallet_cash_transactions 
                    WHERE userid = ? AND admin_status = 'APPROVED' AND coin_name = 'DAN'`;
        const [results] = await connection.execute(sql, [userid]);
        const balance = Number(results[0].amt_in || 0) - Number(results[0].amt_out || 0);
        return Number(balance);
    } catch (error) {
        console.error('Error in getBabyDanBalance:', error);
        return 0;
    }
};

const accountTotalDeposit = async (userid) => {
    try {
        const connection = await getConnection();
        const sql = `SELECT SUM(in_amount) as amt_in 
                    FROM wallet_cash_transactions 
                    WHERE userid = ? AND tran_type = 'Deposit'`;
        const [results] = await connection.execute(sql, [userid]);
        return Number(results[0].amt_in || 0);
    } catch (error) {
        console.error('Error in accountTotalDeposit:', error);
        return 0;
    }
};

const accountTotalEarned = async (userid) => {
    try {
        const connection = await getConnection();
        const sql = `SELECT SUM(in_amount) as amt_in 
                    FROM wallet_cash_transactions 
                    WHERE userid = ? AND tran_type IN ('APR','Binary','Referral APR') AND admin_status = 'APPROVED'`;
        const [results] = await connection.execute(sql, [userid]);
        return Number(results[0].amt_in || 0);
    } catch (error) {
        console.error('Error in accountTotalEarned:', error);
        return 0;
    }
};

const accountTotalWithdraw = async (userid) => {
    try {
        const connection = await getConnection();
        const sql = `SELECT SUM(out_amount) as amt_out 
                    FROM wallet_cash_transactions 
                    WHERE userid = ? AND tran_type = 'Withdraw' AND admin_status = 'APPROVED' AND admin_withdraw_status = 'APPROVED'`;
        const [results] = await connection.execute(sql, [userid]);
        return Number(results[0].amt_out || 0);
    } catch (error) {
        console.error('Error in accountTotalWithdraw:', error);
        return 0;
    }
};

const accountTotalInvActive = async (userid) => {
    try {
        const connection = await getConnection();
        const sql = `SELECT SUM(inv_amount) as inv_amt 
                    FROM member_invest 
                    WHERE userid = ? AND status = 'ACTIVE'`;
        const [results] = await connection.execute(sql, [userid]);
        return Number(results[0].inv_amt || 0);
    } catch (error) {
        console.error('Error in accountTotalInvActive:', error);
        return 0;
    }
};

const accountTotalInv = async (userid) => {
    try {
        const connection = await getConnection();
        const sql = `SELECT SUM(inv_amount) as inv_amt 
                    FROM member_invest 
                    WHERE userid = ? AND (status = 'ACTIVE' OR status = 'COMPLETED')`;
        const [results] = await connection.execute(sql, [userid]);
        return Number(results[0].inv_amt || 0);
    } catch (error) {
        console.error('Error in accountTotalInv:', error);
        return 0;
    }
};

const accountGetCommission = async (userid) => {
    try {
        const connection = await getConnection();
        const sql = `SELECT SUM(in_amount) as amt_in 
                    FROM wallet_cash_transactions 
                    WHERE userid = ? AND tran_type LIKE '%bonus%' AND admin_status = 'APPROVED'`;
        const [results] = await connection.execute(sql, [userid]);
        return Number(results[0].amt_in || 0);
    } catch (error) {
        console.error('Error in accountGetCommission:', error);
        return 0;
    }
};

const accountTransferIn = async (userid) => {
    try {
        const connection = await getConnection();
        const sql = `SELECT SUM(in_amount) as amt_in 
                    FROM wallet_cash_transactions 
                    WHERE userid = ? AND tran_type = 'Transfer in'`;
        const [results] = await connection.execute(sql, [userid]);
        return Number(results[0].amt_in || 0);
    } catch (error) {
        console.error('Error in accountTransferIn:', error);
        return 0;
    }
};

const accountTransferOut = async (userid) => {
    try {
        const connection = await getConnection();
        const sql = `SELECT SUM(out_amount) as amt_out 
                    FROM wallet_cash_transactions 
                    WHERE userid = ? AND tran_type = 'Transfer out'`;
        const [results] = await connection.execute(sql, [userid]);
        return Number(results[0].amt_out || 0);
    } catch (error) {
        console.error('Error in accountTransferOut:', error);
        return 0;
    }
};

const directMembers = async (userid) => {
    try {
        const connection = await getConnection();
        const sql = `SELECT COUNT(*) as count FROM members WHERE sponsorid = ?`;
        const [results] = await connection.execute(sql, [userid]);
        return Number(results[0].count || 0);
    } catch (error) {
        console.error('Error in directMembers:', error);
        return 0;
    }
};

const getFullName = async (userid) => {
    try {
        const connection = await getConnection();
        const sql = `SELECT firstname FROM members WHERE userid = ?`;
        const [results] = await connection.execute(sql, [userid]);
        return results[0]?.firstname || '';
    } catch (error) {
        console.error('Error in getFullName:', error);
        return '';
    }
};

// Fetch DAN price from GeckoTerminal (legacy-compatible)
const getDanPriceUsd = async () => {
    try {
        const response = await fetch('https://api.geckoterminal.com/api/v2/networks/bsc/pools/0x5cd8cd9ef2f3f1771082ecd36e0c2b00deb284de');
        if (!response.ok) return 0;
        const data = await response.json();
        return parseFloat(data.data?.attributes?.base_token_price_usd || 0);
    } catch (error) {
        console.error('Error fetching BABY DAN price:', error);
        return 0;
    }
};

// New helpers for referral, PV, and binary processing
const getSponsorId = async (conn, userid) => {
    const [rows] = await conn.execute(`SELECT sponsorid FROM members WHERE userid = ?`, [userid]);
    return rows[0]?.sponsorid || 0;
};

const referralBonus = async (conn, sponsorId, fromUsername, level, invAmount) => {
    const pc = 0.10; // 10%
    const bonusAmount = invAmount * pc;
    if (bonusAmount <= 0 || sponsorId <= 0) return;
    const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await conn.execute(
        `INSERT INTO wallet_cash_transactions (
            userid, tran_type, in_amount, out_amount, vat_amount, fee_amount,
            detail, created_datetime, admin_username, admin_status, admin_datetime, admin_msg
        ) VALUES (?, 'Referral bonus', ?, 0.00, 0.00, 0.00, ?, ?, 'System', 'APPROVED', ?, ?)`,
        [
            sponsorId,
            invAmount * pc,
            `Referral bonus level ${level} from ${fromUsername}`,
            nowSql,
            nowSql,
            `Referral bonus level ${level} from ${fromUsername}`
        ]
    );
};

const pvAdd = async (conn, userid, pv, next, useridStart) => {
    const [memberRows] = await conn.execute(
        `SELECT userid, l_member, r_member, parentid FROM members WHERE userid = ?`,
        [userid]
    );
    if (!memberRows || memberRows.length === 0) return;
    const member = memberRows[0];
    const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');

    if (next === 0) {
        await conn.execute(`UPDATE members SET s_pv = s_pv + ? WHERE userid = ?`, [pv, member.userid]);
        await conn.execute(
            `INSERT INTO mlmpvhistory (l_pv, r_pv, s_pv, from_id, to_id , save_date) VALUES (0,0,?, ?, ?, ?)`,
            [pv, useridStart, member.userid, nowSql]
        );
    }

    if (member.l_member === 1) {
        await conn.execute(`UPDATE members SET l_pv = l_pv + ? WHERE userid = ?`, [pv, member.parentid]);
        await conn.execute(
            `INSERT INTO mlmpvhistory (l_pv, r_pv, s_pv, from_id, to_id , save_date) VALUES (?,0,0, ?, ?, ?)`,
            [pv, useridStart, member.parentid, nowSql]
        );
    } else if (member.r_member === 1) {
        await conn.execute(`UPDATE members SET r_pv = r_pv + ? WHERE userid = ?`, [pv, member.parentid]);
        await conn.execute(
            `INSERT INTO mlmpvhistory (l_pv, r_pv, s_pv, from_id, to_id , save_date) VALUES (0,?,0, ?, ?, ?)`,
            [pv, useridStart, member.parentid, nowSql]
        );
    }

    const parentId = member.parentid;
    if (parentId && Number(parentId) >= 1) {
        await pvAdd(conn, parentId, pv, next + 1, useridStart);
    }
};

const settleBinaryForUser = async (conn, userid) => {
    const [rows] = await conn.execute(`SELECT userid, l_pv, r_pv FROM members WHERE userid = ?`, [userid]);
    if (!rows || rows.length === 0) return;
    const member = rows[0];
    const lPv = Number(member.l_pv) || 0;
    const rPv = Number(member.r_pv) || 0;
    const biCom = Math.min(lPv, rPv);
    if (biCom <= 0) return;

    const bonusAmount = biCom * 0.08; // 8%
    const nowSql = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Credit binary bonus
    await conn.execute(
        `INSERT INTO wallet_cash_transactions (
            userid, created_datetime, tran_type, detail, in_amount, admin_status
        ) VALUES (?, ?, 'Binary', 'Binary bonus received', ?, 'APPROVED')`,
        [userid, nowSql, bonusAmount]
    );

    // Update remaining PV
    const newL = lPv - biCom;
    const newR = rPv - biCom;
    await conn.execute(`UPDATE members SET l_pv = ?, r_pv = ? WHERE userid = ?`, [newL, newR, userid]);

    // Record negative pair deduction in mlmpvhistory
    const del = (-1) * biCom;
    await conn.execute(
        `INSERT INTO mlmpvhistory (l_pv, r_pv, from_id, to_id , save_date) VALUES (?, ?, ?, 0, ?)`,
        [del, del, userid, nowSql]
    );
};

const getEarningsCapAdjustments = async (userid) => {
    try {
        const connection = await getConnection();
        const sql = `SELECT SUM(out_amount) as total_adjustment 
                    FROM wallet_cash_transactions 
                    WHERE userid = ? AND tran_type = 'Earnings Cap Adjustment'`;
        const [results] = await connection.execute(sql, [userid]);
        
        return Number(results[0].total_adjustment || 0);
    } catch (error) {
        console.error('Error in getEarningsCapAdjustments:', error);
        return 0;
    }
};

module.exports = {
    getDanBalance,
    accountTotalDeposit,
    accountTotalEarned,
    accountTotalWithdraw,
    accountTotalInvActive,
    accountTotalInv,
    accountGetCommission,
    accountTransferIn,
    accountTransferOut,
    directMembers,
    getFullName,
    getDanPriceUsd,
    getSponsorId,
    referralBonus,
    pvAdd,
    settleBinaryForUser,
    getEarningsCapAdjustments
};
