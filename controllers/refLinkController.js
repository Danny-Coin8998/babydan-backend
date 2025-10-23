const { getConnection } = require('../config/database');

const getReferralLinks = async (req, res) => {
    try {
        // Get userid from JWT token (set by authenticateToken middleware)
        const { userid } = req.user;
        
        // Get user's ref_code
        const connection = await getConnection();
        const sql = `SELECT ref_code FROM members WHERE userid = ?`;
        const [results] = await connection.execute(sql, [userid]);
        
        if (results.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        const ref_code = results[0].ref_code;
        const baseUrl = process.env.BASE_URL || 'https://dan-staking.com';
        
        const referralLinks = {
            left_side: `${baseUrl}/register?ref=${ref_code}&side=left`,
            right_side: `${baseUrl}/register?ref=${ref_code}&side=right`
        };

        res.json({
            success: true,
            data: {
                ref_code,
                referral_links: referralLinks
            }
        });
    } catch (error) {
        console.error('Referral Link API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getReferralLinks
}; 