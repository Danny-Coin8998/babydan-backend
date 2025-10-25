const { getConnection } = require('../config/database');
const {
    getDanBalance,
    accountTotalDeposit,
    accountTotalEarned,
    accountTotalWithdraw,
    accountTotalInvActive,
    accountGetCommission,
    accountTransferIn,
    accountTransferOut,
    directMembers,
    getEarningsCapAdjustments
} = require('./helpers');

const getDashboardData = async (req, res) => {
    try {
        // Get userid from JWT token (set by authenticateToken middleware)
        const { userid } = req.user;
        
        // Get member creation date
        const connection = await getConnection();
        const memberQuery = `SELECT datecreated FROM members WHERE userid = ?`;
        const [memberResult] = await connection.execute(memberQuery, [userid]);
        const created_at = memberResult[0]?.datecreated;

        // Check if user has invested
        const investQuery = `SELECT * FROM member_invest WHERE userid = ? AND status = 'active' AND coin_name = 'USDT'`;
        const [investResult] = await connection.execute(investQuery, [userid]);
        const has_invested = investResult.length > 0;

        // Calculate countdown end date if not invested
        let countdown_end = null;
        if (!has_invested && created_at) {
            const createdDate = new Date(created_at);
            createdDate.setDate(createdDate.getDate() + 120); // Add 120 days
            countdown_end = createdDate.toISOString();
        }

        // Get total investment from packages table (p_amount)
        const investmentQuery = `SELECT SUM(P.p_amount) as total_inv 
                                FROM member_invest A 
                                INNER JOIN packages P ON A.p_id = P.p_id 
                                WHERE A.userid = ? AND (A.status = 'ACTIVE' OR A.status = 'COMPLETED')`;
        const [investmentResult] = await connection.execute(investmentQuery, [userid]);
        const totalInv = Number(investmentResult[0].total_inv || 0);

        const totalActiveUsdtQuery = `SELECT SUM(P.p_amount) as total_inv 
                                FROM member_invest A 
                                INNER JOIN packages P ON A.p_id = P.p_id 
                                WHERE A.userid = ? AND (A.status = 'ACTIVE'`;
        const [totalActiveUsdtResult] = await connection.execute(totalActiveUsdtQuery, [userid]);
        const totalActiveUsdt = Number(totalActiveUsdtResult[0].total_inv || 0);

        // Get all other dashboard data
        const [
            accountBalance,
            totalDeposit,
            totalEarned,
            totalWithdraw,
            totalInvActive,
            totalCommission,
            totalTransferIn,
            totalTransferOut,
            totalReferrals,
            earningsCapAdjustments
        ] = await Promise.all([
            getDanBalance(userid),
            accountTotalDeposit(userid),
            accountTotalEarned(userid),
            accountTotalWithdraw(userid),
            accountTotalInvActive(userid),
            accountGetCommission(userid),
            accountTransferIn(userid),
            accountTransferOut(userid),
            directMembers(userid),
            getEarningsCapAdjustments(userid)
        ]);

        // Calculate new total_earned (old total_earned + total_commission)
        const newTotalEarned = totalEarned + totalCommission;

        // Calculate earned percentage (subtract earnings cap adjustments from newTotalEarned)
        const adjustedTotalEarned = newTotalEarned - earningsCapAdjustments;
        const earnedPercentage = totalInv > 0 ? (100 * accountBalance) / (totalInv*33) : 0;

        const totals = {
            total_deposit: Number(totalDeposit),
            total_earned: Number(newTotalEarned),
            total_withdraw: Number(totalWithdraw),
            total_active_usdt: Number(totalActiveUsdt),
            total_investment_active: Number(totalInvActive),
            total_investment: Number(totalInv),
            total_commission: Number(totalCommission),
            total_transfer_in: Number(totalTransferIn),
            total_transfer_out: Number(totalTransferOut),
            total_referrals: Number(totalReferrals),
            earned_percentage: Number(earnedPercentage)
        };

        res.json({
            success: true,
            data: {
                member: {
                    created_at,
                    has_invested,
                    countdown_end
                },
                balances: {
                    account_balance: Number(accountBalance),
                    ...totals
                }
            }
        });
    } catch (error) {
        console.error('Dashboard API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getDashboardData
};
