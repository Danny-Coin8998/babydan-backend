const { getConnection } = require('../config/database');
const { getFullName, directMembers } = require('./helpers');

const getTeamData = async (req, res) => {
    try {
        // Get userid from JWT token (set by authenticateToken middleware)
        const { userid } = req.user;
        
        // Optional depth parameter for recursive tree (default 2, max 6)
        const depthParam = parseInt(req.query.depth, 10);
        const maxDepth = 10;
        const depth = Number.isFinite(depthParam) ? Math.max(0, Math.min(depthParam, maxDepth)) : 10;
        
        // Get user info
        const connection = await getConnection();
        const userSql = `SELECT userid, firstname, sponsorid, parentid, ref_code, s_pv, l_pv, r_pv 
                        FROM members 
                        WHERE userid = ?`;
        const [userResult] = await connection.execute(userSql, [userid]);
        const user = userResult[0];

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Get sponsor and upline names
        const [sponsorName, uplineName] = await Promise.all([
            getFullName(user.sponsorid),
            getFullName(user.parentid)
        ]);

        // Get children (left and right)
        const leftChildSql = `SELECT userid, firstname, s_pv, l_pv, r_pv 
                             FROM members 
                             WHERE parentid = ? AND l_member = 1`;
        const rightChildSql = `SELECT userid, firstname, s_pv, l_pv, r_pv 
                              FROM members 
                              WHERE parentid = ? AND r_member = 1`;
        
        const [[leftChild], [rightChild]] = await Promise.all([
            connection.execute(leftChildSql, [userid]),
            connection.execute(rightChildSql, [userid])
        ]);

        // Recursive subtree builder
        const buildSubtree = async (nodeId, currentDepth) => {
            // Base: stop if depth reached or invalid id
            if (!nodeId || currentDepth > depth) {
                return null;
            }
            const sql = `SELECT userid, firstname, s_pv, l_pv, r_pv, l_member, r_member 
                         FROM members WHERE userid = ?`;
            const [[row]] = await connection.execute(sql, [nodeId]);
            if (!row) return null;

            // If at limit, do not fetch children
            if (currentDepth === depth) {
                return {
                    userid: row.userid,
                    firstname: row.firstname,
                    s_pv: row.s_pv,
                    l_pv: row.l_pv,
                    r_pv: row.r_pv,
                    children: { left: null, right: null }
                };
            }

            const [[left]] = await connection.execute(
                `SELECT userid FROM members WHERE parentid = ? AND l_member = 1 LIMIT 1`,
                [nodeId]
            );
            const [[right]] = await connection.execute(
                `SELECT userid FROM members WHERE parentid = ? AND r_member = 1 LIMIT 1`,
                [nodeId]
            );

            const [leftTree, rightTree] = await Promise.all([
                buildSubtree(left?.userid || null, currentDepth + 1),
                buildSubtree(right?.userid || null, currentDepth + 1)
            ]);

            return {
                userid: row.userid,
                firstname: row.firstname,
                s_pv: row.s_pv,
                l_pv: row.l_pv,
                r_pv: row.r_pv,
                children: { left: leftTree, right: rightTree }
            };
        };

        // Get total referrals count
        const totalReferrals = await directMembers(userid);

        // Build full tree for the authenticated user
        const tree = await buildSubtree(userid, 0);

        res.json({
            success: true,
            data: {
                user: {
                    userid: user.userid,
                    firstname: user.firstname,
                    ref_code: user.ref_code,
                    s_pv: user.s_pv,
                    l_pv: user.l_pv,
                    r_pv: user.r_pv
                },
                sponsor: {
                    userid: user.sponsorid,
                    name: sponsorName
                },
                upline: {
                    userid: user.parentid,
                    name: uplineName
                },
                children: {
                    left: leftChild || null,
                    right: rightChild || null
                },
                total_referrals: totalReferrals,
                tree,
                depth
            }
        });
    } catch (error) {
        console.error('My Team API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = {
    getTeamData
}; 
