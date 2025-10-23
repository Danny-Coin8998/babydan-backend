const { getDanBalance } = require('./helpers');

const getBalance = async (req, res) => {
    try {
        const { userid } = req.user;
        const danBalance = await getDanBalance(userid);

        res.json({
            success: true,
            data: {
                userid,
                baby_dan_balance: Number(danBalance)
            }
        });
    } catch (error) {
        console.error('Get Balance API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getBalance
}; 