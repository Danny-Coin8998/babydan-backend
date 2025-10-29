const { getConnection } = require('../config/database');
const { buyPackage } = require('./buyPackageController');

// GET /admin/daily-invest
const getDailyInvest = async (req, res) => {
    try {
        const connection = await getConnection();

        const sql = `
            SELECT 
                DATE_FORMAT(DATE_ADD(mi.inv_date, INTERVAL 7 HOUR), '%Y-%m-%d') AS day,
                SUM(p.p_amount) AS total_amount
            FROM member_invest mi
            LEFT JOIN packages p ON p.p_id = mi.p_id
            WHERE DATE(DATE_ADD(mi.inv_date, INTERVAL 7 HOUR)) BETWEEN 
                  DATE_SUB(DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)), INTERVAL 9 DAY)
                  AND DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR))
            GROUP BY day
            ORDER BY day DESC
        `;

        const [rows] = await connection.execute(sql);

        // Build list of last 10 days (today .. today-9) in YYYY-MM-DD using UTC+7
        const now = new Date();
        const tzOffsetMs = 7 * 60 * 60 * 1000;

        const formatYMD = (d) => {
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            const da = String(d.getUTCDate()).padStart(2, '0');
            return `${y}-${m}-${da}`;
        };

        const days = [];
        for (let i = 0; i < 10; i++) {
            const d = new Date(now.getTime() + tzOffsetMs);
            d.setUTCDate(d.getUTCDate() - i);
            d.setUTCHours(0, 0, 0, 0);
            days.push(formatYMD(d));
        }

        const dayToTotal = new Map();
        for (const r of rows) {
            dayToTotal.set(r.day, Number(r.total_amount || 0));
        }

        const result = days.map((day) => ({
            day,
            total_amount: dayToTotal.get(day) || 0
        }));

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error in getDailyInvest:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getDailyInvest,
    // Admin-triggered invest: POST /admin/invest { p_id, wallet_address }
    adminInvest: async (req, res) => {
        try {
            const { p_id, wallet_address } = req.body || {};

            if (!p_id || !wallet_address) {
                return res.status(400).json({ success: false, error: 'p_id and wallet_address are required' });
            }

            // Validate wallet address format (basic ETH format as elsewhere)
            if (!/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
                return res.status(400).json({ success: false, error: 'Invalid Ethereum wallet address format' });
            }

            const connection = await getConnection();
            const [rows] = await connection.execute(
                `SELECT userid FROM members WHERE wallet_address = ? LIMIT 1`,
                [wallet_address]
            );

            if (!rows || rows.length === 0) {
                return res.status(404).json({ success: false, error: 'User not found for wallet_address' });
            }

            const userid = rows[0].userid;

            // Build a minimal request object compatible with buyPackage
            const buyReq = {
                user: { userid },
                body: { p_id },
            };

            // Proxy the response so we can relay the result
            const buyRes = {
                status(code) {
                    this.statusCode = code;
                    return this;
                },
                json(payload) {
                    if (this.statusCode && this.statusCode !== 200) {
                        return res.status(this.statusCode).json(payload);
                    }
                    return res.json(payload);
                }
            };

            // Delegate to existing flow
            return buyPackage(buyReq, buyRes);
        } catch (error) {
            console.error('Error in adminInvest:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }
};


