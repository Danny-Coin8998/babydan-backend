// controllers/transferController.js
const { getConnection } = require('../config/database');
const { ethers } = require('ethers');

const isValidEthereumAddress = (address) => {
	try {
		if (!ethers.isAddress(address)) return false;
		ethers.getAddress(address);
		return true;
	} catch {
		return false;
	}
};

const createTransfer = async (req, res) => {
	try {
		const { userid } = req.user;
		const { to_wallet_address, baby_dan_amount } = req.body || {};

		if (!to_wallet_address || !baby_dan_amount) {
			return res.status(400).json({ success: false, error: 'to_wallet_address and baby_dan_amount are required' });
		}

		if (!isValidEthereumAddress(to_wallet_address)) {
			return res.status(400).json({ success: false, error: 'Invalid wallet address format' });
		}

		const amount = parseFloat(baby_dan_amount);
		if (isNaN(amount) || amount <= 0) {
			return res.status(400).json({ success: false, error: 'baby_dan_amount must be a positive number' });
		}

		const connection = await getConnection();

		// Find recipient user
		const [toRows] = await connection.execute(
			`SELECT userid, wallet_address, username FROM members WHERE wallet_address = ? LIMIT 1`,
			[to_wallet_address]
		);
		if (toRows.length === 0) {
			return res.status(404).json({ success: false, error: 'Recipient not found' });
		}
		const toUser = toRows[0];
		if (toUser.userid === userid) {
			return res.status(400).json({ success: false, error: 'Cannot transfer to own wallet' });
		}

		// Get sender balance (APPROVED only)
		const [balRows] = await connection.execute(
			`SELECT 
				COALESCE(SUM(CASE WHEN admin_status = 'APPROVED' THEN in_amount ELSE 0 END), 0) - 
				COALESCE(SUM(CASE WHEN admin_status = 'APPROVED' THEN out_amount ELSE 0 END), 0) AS balance
			 FROM wallet_cash_transactions WHERE userid = ?`,
			[userid]
		);
		const senderBalance = parseFloat(balRows[0].balance || 0);
		if (senderBalance < amount) {
			return res.status(400).json({ success: false, error: 'Insufficient balance', data: { current_balance: senderBalance, required_amount: amount, shortfall: +(amount - senderBalance).toFixed(6) } });
		}

		const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
		const conn = await connection.getConnection();
		try {
			await conn.beginTransaction();

			// Transfer out (sender)
			const [outRes] = await conn.execute(
				`INSERT INTO wallet_cash_transactions (
					userid, tran_type, coin_name, in_amount, out_amount,
					vat_amount, fee_amount, detail, created_datetime,
					admin_username, admin_status, admin_datetime, admin_msg, is_show
				) VALUES (?, 'Transfer out', 'DAN', 0.00, ?, 0.00, 0.00, ?, ?, 'System', 'APPROVED', ?, 'Transfer out', 'YES')`,
				[userid, amount, `Transfer to ${toUser.wallet_address}`, now, now]
			);

			// Transfer in (recipient)
			const [inRes] = await conn.execute(
				`INSERT INTO wallet_cash_transactions (
					userid, tran_type, coin_name, in_amount, out_amount,
					vat_amount, fee_amount, detail, created_datetime,
					admin_username, admin_status, admin_datetime, admin_msg, is_show
				) VALUES (?, 'Transfer in', 'DAN', ?, 0.00, 0.00, 0.00, ?, ?, 'System', 'APPROVED', ?, 'Transfer in', 'YES')`,
				[toUser.userid, amount, `Transfer from userid ${userid}`, now, now]
			);

			await conn.commit();

			return res.json({
				success: true,
				message: 'Transfer completed',
				data: {
					from_userid: userid,
					to_userid: toUser.userid,
					baby_dan_amount: amount,
					transactions: {
						out_t_id: outRes.insertId,
						in_t_id: inRes.insertId
					},
					balance: {
						before: +senderBalance.toFixed(6),
						after: +(senderBalance - amount).toFixed(6)
					}
				}
			});
		} catch (err) {
			await conn.rollback();
			throw err;
		} finally {
			conn.release();
		}
	} catch (error) {
		console.error('Create Transfer API error:', error);
		res.status(500).json({ success: false, error: error.message });
	}
};

module.exports = { createTransfer }; 