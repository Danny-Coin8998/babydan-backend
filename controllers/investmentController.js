const { getConnection } = require('../config/database');

const getInvestmentData = async (req, res) => {
    try {
        // Get userid from JWT token (set by authenticateToken middleware)
        const { userid } = req.user;
        
        const connection = await getConnection();
        const sql = `SELECT A.*, P.p_amount 
                    FROM member_invest A 
                    INNER JOIN packages P ON A.p_id = P.p_id 
                    WHERE A.userid = ? 
                    ORDER BY A.inv_id DESC`;
        
        const [results] = await connection.execute(sql, [userid]);
        
        const investments = results.map(investment => ({
            inv_id: investment.inv_id,
            inv_date: investment.inv_date,
            // inv_amount: Number(investment.inv_amount),
            p_amount: Number(investment.p_amount),
            status: investment.status,
            coin_name: investment.coin_name
        }));

        res.json({
            success: true,
            data: {
                investments,
                total_count: investments.length
            }
        });
    } catch (error) {
        console.error('My Investment API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getInvestmentData
};
