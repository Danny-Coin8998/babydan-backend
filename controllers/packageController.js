const { getConnection } = require('../config/database');
const { getDanBalance, getDanPriceUsd } = require('./helpers');

const getPackages = async (req, res) => {
    try {
        const { userid } = req.user;
        const connection = await getConnection();
        const sql = `SELECT p_id, p_name, p_percent, p_period, p_amount, p_order
                     FROM packages
                     WHERE is_enabled = 'YES'
                     ORDER BY p_order ASC`;
        const [results] = await connection.execute(sql);

        // Get DAN price
        const danPrice = await getDanPriceUsd();
        
        // Get user balance if userid is provided (optional JWT)
        let userBalance = 0;
        if (req.user && userid) {
            userBalance = await getDanBalance(userid);
        }

        const packages = results.map(p => {
            const usdtPrice = parseFloat(p.p_amount);
            const requiredDan = danPrice > 0 ? usdtPrice / danPrice : 0;
            const canAfford = userBalance >= requiredDan;
            
            return {
                p_id: p.p_id,
                p_name: p.p_name,
                p_percent: Number(p.p_percent),
                p_period: p.p_period,
                p_amount: usdtPrice,
                p_order: p.p_order,
                required_baby_dan: requiredDan,
                can_afford: true,
                user_balance: userBalance,
                dan_price: danPrice
            };
        });

        res.json({ 
            success: true, 
            data: { 
                packages, 
                total_count: packages.length,
                dan_price: danPrice,
                user_balance: userBalance
            } 
        });
    } catch (error) {
        console.error('Get Packages API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getPackages
}; 
