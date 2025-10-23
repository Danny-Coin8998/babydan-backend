const { getConnection } = require('../config/database');

const getHistoryData = async (req, res) => {
    try {
        // Get userid from JWT token (set by authenticateToken middleware)
        const { userid } = req.user;
        const { type = 'all' } = req.query;
        
        const connection = await getConnection();
        let sql = '';
        let params = [userid];
        
        switch (type) {
            case 'deposit':
                sql = `SELECT * FROM wallet_cash_transactions 
                       WHERE userid = ? AND tran_type = 'Deposit' 
                       ORDER BY t_id DESC`;
                break;
            case 'withdraw':
                sql = `SELECT * FROM wallet_cash_transactions 
                       WHERE userid = ? AND tran_type = 'Withdraw' 
                       ORDER BY t_id DESC`;
                break;
            case 'transfer':
                sql = `SELECT * FROM wallet_cash_transactions 
                       WHERE userid = ? AND tran_type IN ('Transfer in', 'Transfer out') 
                       ORDER BY t_id DESC`;
                break;
            case 'commission':
                sql = `SELECT * FROM wallet_cash_transactions 
                       WHERE userid = ? AND tran_type LIKE '%bonus%' 
                       ORDER BY t_id DESC`;
                break;
            case 'binary':
                sql = `SELECT * FROM wallet_cash_transactions 
                       WHERE userid = ? AND tran_type = 'Binary' 
                       ORDER BY t_id DESC`;
                break;
            case 'apr':
                sql = `SELECT * FROM wallet_cash_transactions 
                       WHERE userid = ? AND tran_type = 'APR' 
                       ORDER BY t_id DESC`;
                break;
            default:
                sql = `SELECT * FROM wallet_cash_transactions 
                       WHERE userid = ? 
                       ORDER BY t_id DESC`;
        }
        
        const [results] = await connection.execute(sql, params);

        const toNumber = (v) => (v === null || v === undefined ? 0 : Number(v));
        const numericFields = [
            'in_amount_thb', 'in_ex_rate', 'in_amount',
            'out_amount', 'out_ex_rate', 'out_amount_thb',
            'vat_amount', 'fee_amount', 'provider_amount',
            'out_amount_dan', 'fee_dan'
        ];

        const transactions = results.map((row) => {
            const out = { ...row };
            numericFields.forEach((f) => {
                if (Object.prototype.hasOwnProperty.call(out, f)) {
                    out[f] = toNumber(out[f]);
                }
            });
            
            // Change Binary to Paring
            if (out.tran_type === 'Binary') {
                out.tran_type = 'Pairing';
            }
            
            // Change DAN to BABY DAN in coin_name
            if (out.coin_name === 'DAN') {
                out.coin_name = 'BABY DAN';
            }
            
            // Change DAN to BABY DAN in detail text
            if (out.detail && out.detail.includes('DAN')) {
                out.detail = out.detail.replace(/DAN/g, 'BABY DAN');
            }
            
            // Change field names from dan to baby_dan
            if (out.want_dan !== undefined) {
                out.want_baby_dan = out.want_dan;
                delete out.want_dan;
            }
            if (out.out_amount_dan !== undefined) {
                out.out_amount_baby_dan = out.out_amount_dan;
                delete out.out_amount_dan;
            }
            if (out.fee_dan !== undefined) {
                out.fee_baby_dan = out.fee_dan;
                delete out.fee_dan;
            }
            
            return out;
        });
        
        res.json({
            success: true,
            data: {
                transactions,
                total_count: transactions.length,
                type: type
            }
        });
    } catch (error) {
        console.error('History API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getHistoryData
};
