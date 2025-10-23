const { getConnection } = require('../config/database');

const getDirectReferrals = async (req, res) => {
    try {
        // Get userid from JWT token (set by authenticateToken middleware)
        const { userid } = req.user;
        
        const connection = await getConnection();
        const sql = `SELECT userid, wallet_address, firstname, emailaddress, emailaddress_status, datecreated 
                    FROM members 
                    WHERE sponsorid = ? 
                    ORDER BY userid DESC`;
        
        const [results] = await connection.execute(sql, [userid]);
        
        const referrals = results.map((referral, index) => ({
            no: index + 1,
            userid: referral.userid,
            wallet_address: referral.wallet_address,
            name: referral.firstname,
            email: referral.emailaddress,
            status: referral.emailaddress_status,
            register_date: referral.datecreated
        }));

        res.json({
            success: true,
            data: {
                referrals,
                total_count: referrals.length
            }
        });
    } catch (error) {
        console.error('My Direct Referral API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getDirectReferrals
};
