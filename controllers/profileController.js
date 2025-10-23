const { getConnection } = require('../config/database');

const updateName = async (req, res) => {
    try {
        const { userid } = req.user;
        const { firstname, lastname } = req.body || {};

        // Both required
        if (!firstname || !lastname) {
            return res.status(400).json({ success: false, error: 'Firstname and lastname are required' });
        }

        const fn = firstname.trim();
        const ln = lastname.trim();

        if (fn.length < 2 || ln.length < 2) {
            return res.status(400).json({ success: false, error: 'Firstname and lastname must be at least 2 characters' });
        }
        if (fn.length > 100 || ln.length > 100) {
            return res.status(400).json({ success: false, error: 'Firstname and lastname must be less than 100 characters' });
        }

        const connection = await getConnection();
        const sql = `UPDATE members SET firstname = ?, lastname = ? WHERE userid = ?`;
        const [result] = await connection.execute(sql, [fn, ln, userid]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        return res.json({ success: true, message: 'Name updated successfully' });
    } catch (error) {
        console.error('Update Name API error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

const getProfile = async (req, res) => {
    try {
        const { userid } = req.user;
        const connection = await getConnection();

        const sql = `SELECT userid, username, firstname, lastname, wallet_address, datecreated, lastlogindate 
                     FROM members WHERE userid = ?`;
        const [results] = await connection.execute(sql, [userid]);

        if (!results || results.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const user = results[0];

        return res.json({
            success: true,
            data: {
                userid: user.userid,
                username: user.username,
                firstname: user.firstname || '',
                lastname: user.lastname || '',
                wallet_address: user.wallet_address || '',
                registration_date: user.datecreated,
                last_login: user.lastlogindate
            }
        });
    } catch (error) {
        console.error('Get Profile API error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

module.exports = { updateName, getProfile };
