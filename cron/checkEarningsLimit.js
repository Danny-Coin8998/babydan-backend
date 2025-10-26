#!/usr/bin/env node

/**
 * Cron Job: Check Earnings Limit (3x Investment Cap)
 * 
 * This cron job checks all users whose total_earned exceeds 3x their total_investment
 * and performs the following actions:
 * 1. Calculates excess earnings (total_earned - 3 * total_investment)
 * 2. Creates a deduction transaction to remove excess earnings
 * 3. Marks all active packages as COMPLETED
 * 
 * Run this script with: node cron/checkEarningsLimit.js
 * Or schedule with system cron to run every midnight
 */

require('dotenv').config();
const { getConnection } = require('../config/database');
const {
    accountTotalEarned,
    accountGetCommission,
    getDanBalance
} = require('../controllers/helpers');

const EARNINGS_MULTIPLIER_LIMIT = 3; // 3x investment limit

/**
 * Get all users with their earnings and investment data
 */
const getUsersWithEarnings = async () => {
    try {
        const connection = await getConnection();
        
        // Get all users who have investments
        const sql = `
            SELECT DISTINCT userid 
            FROM member_invest 
            WHERE status IN ('ACTIVE', 'COMPLETED')
            ORDER BY userid
        `;
        
        const [users] = await connection.execute(sql);
        console.log(`📊 Found ${users.length} users with investments`);
        
        return users;
    } catch (error) {
        console.error('❌ Error fetching users:', error);
        throw error;
    }
};

/**
 * Get total investment by joining with packages table and summing p_amount
 * Converts USD to Thai Baht by multiplying by 33
 */
const getTotalInvestmentFromPackages = async (userid) => {
    try {
        const connection = await getConnection();
        const sql = `
            SELECT SUM(p.p_amount) as total_inv 
            FROM member_invest mi
            JOIN packages p ON mi.p_id = p.p_id
            WHERE mi.userid = ? AND (mi.status = 'ACTIVE' OR mi.status = 'COMPLETED')
        `;
        const [results] = await connection.execute(sql, [userid]);
        const totalInvUsd = Number(results[0].total_inv || 0);
        return totalInvUsd * 33;
        // return totalInvUsd;
    } catch (error) {
        console.error(`Error in getTotalInvestmentFromPackages for user ${userid}:`, error);
        return 0;
    }
};

/**
 * Check if user exceeds earnings limit and calculate excess
 */
const checkUserEarningsLimit = async (userid) => {
    try {
        // Get total earned (APR + Binary + Referral APR)
        const totalEarned = await accountTotalEarned(userid);
        
        // Get total commission (bonus earnings)
        const totalCommission = await accountGetCommission(userid);
        
        // Get user's DAN balance
        const userBalance = await getDanBalance(userid);
        
        // Get total investment from packages table (p_amount converted to Thai Baht by *33)
        const totalInvestment = await getTotalInvestmentFromPackages(userid);
        
        // Calculate new total earned (same as dashboardController.js)
        const newTotalEarned = totalEarned + totalCommission;
        
        // Calculate 3x investment limit
        const earningsLimit = totalInvestment * EARNINGS_MULTIPLIER_LIMIT;
        
        // Check if user exceeds limit using balance instead of newTotalEarned
        const exceedsLimit = userBalance > earningsLimit;
        const excessAmount = exceedsLimit ? userBalance - earningsLimit : 0;
        
        return {
            userid,
            totalEarned: Number(totalEarned),
            totalCommission: Number(totalCommission),
            newTotalEarned: Number(newTotalEarned),
            userBalance: Number(userBalance),
            totalInvestment: Number(totalInvestment),
            earningsLimit: Number(earningsLimit),
            exceedsLimit,
            excessAmount: Number(excessAmount)
        };
    } catch (error) {
        console.error(`❌ Error checking user ${userid}:`, error);
        return null;
    }
};

/**
 * Create deduction transaction for excess earnings
 */
const createDeductionTransaction = async (conn, userid, excessAmount) => {
    try {
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        
        const sql = `
            INSERT INTO wallet_cash_transactions (
                userid, tran_type, in_amount, out_amount, vat_amount, fee_amount,
                detail, created_datetime, admin_username, admin_status, 
                admin_datetime, admin_msg, coin_name
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            userid,                                    // userid
            'Earnings Cap Adjustment',                 // tran_type
            0.00,                                      // in_amount
            excessAmount,                              // out_amount
            0.00,                                      // vat_amount
            0.00,                                      // fee_amount
            `Earnings cap adjustment - excess removed (3x investment limit)`, // detail
            now,                                       // created_datetime
            'System',                                  // admin_username
            'APPROVED',                                // admin_status
            now,                                       // admin_datetime
            `Excess earnings removed: ${excessAmount} DAN`, // admin_msg
            'DAN'                                      // coin_name
        ];
        
        const [result] = await conn.execute(sql, values);
        console.log(`✅ Created deduction transaction for user ${userid}: ${excessAmount} DAN`);
        
        return result.insertId;
    } catch (error) {
        console.error(`❌ Error creating deduction transaction for user ${userid}:`, error);
        throw error;
    }
};

/**
 * Mark all active packages as COMPLETED
 */
const completeActivePackages = async (conn, userid) => {
    try {
        const sql = `
            UPDATE member_invest 
            SET status = 'COMPLETED', 
                admin_username = 'System'
            WHERE userid = ? AND status = 'ACTIVE'
        `;
        
        const [result] = await conn.execute(sql, [userid]);
        console.log(`✅ Completed ${result.affectedRows} active packages for user ${userid}`);
        
        return result.affectedRows;
    } catch (error) {
        console.error(`❌ Error completing packages for user ${userid}:`, error);
        throw error;
    }
};

/**
 * Process a single user who exceeds earnings limit
 */
const processUserExceedingLimit = async (userData) => {
    const { userid, excessAmount } = userData;
    
    try {
        const connection = await getConnection();
        const conn = await connection.getConnection();
        
        try {
            await conn.beginTransaction();
            
            // 1. Create deduction transaction
            await createDeductionTransaction(conn, userid, excessAmount);
            
            // 2. Complete all active packages
            const completedPackages = await completeActivePackages(conn, userid);
            
            await conn.commit();
            
            console.log(`✅ Successfully processed user ${userid}:`);
            console.log(`   - Excess removed: ${excessAmount} DAN`);
            console.log(`   - Packages completed: ${completedPackages}`);
            
            return {
                success: true,
                userid,
                excessAmount,
                completedPackages
            };
            
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
        
    } catch (error) {
        console.error(`❌ Error processing user ${userid}:`, error);
        return {
            success: false,
            userid,
            error: error.message
        };
    }
};

/**
 * Main cron job function
 */
const runEarningsLimitCheck = async () => {
    console.log('🚀 Starting Earnings Limit Check Cron Job');
    console.log(`📅 Time: ${new Date().toISOString()}`);
    console.log(`📊 Checking for users exceeding ${EARNINGS_MULTIPLIER_LIMIT}x investment limit`);
    console.log('─'.repeat(60));
    
    try {
        // Get all users with investments
        const users = await getUsersWithEarnings();
        
        if (users.length === 0) {
            console.log('ℹ️  No users with investments found');
            return;
        }
        
        const results = {
            totalUsers: users.length,
            usersExceedingLimit: 0,
            usersProcessed: 0,
            totalExcessRemoved: 0,
            totalPackagesCompleted: 0,
            errors: []
        };
        
        // Check each user
        for (const user of users) {
            const userData = await checkUserEarningsLimit(user.userid);
            
            if (!userData) {
                results.errors.push(`Failed to check user ${user.userid}`);
                continue;
            }
            
            // Print user details for each user checked
            console.log(`👤 User ${userData.userid}:`);
            console.log(`   - User Balance: ${userData.userBalance} DAN`);
            console.log(`   - Earnings Limit: ${userData.earningsLimit} THB`);
            console.log(`   - Total Investment: ${userData.totalInvestment} THB`);
            console.log(`   - Status: ${userData.exceedsLimit ? 'EXCEEDS LIMIT' : 'Within limit'}`);
            
            if (userData.exceedsLimit) {
                results.usersExceedingLimit++;
                console.log(`⚠️  EXCESS AMOUNT: ${userData.excessAmount} DAN`);
                
                // Process the user
                const processResult = await processUserExceedingLimit(userData);
                
                if (processResult.success) {
                    results.usersProcessed++;
                    results.totalExcessRemoved += processResult.excessAmount;
                    results.totalPackagesCompleted += processResult.completedPackages;
                } else {
                    results.errors.push(`Failed to process user ${user.userid}: ${processResult.error}`);
                }
                
                console.log('─'.repeat(40));
            } else {
                console.log('─'.repeat(30));
            }
        }
        
        // Print summary
        console.log('📊 CRON JOB SUMMARY:');
        console.log(`   Total users checked: ${results.totalUsers}`);
        console.log(`   Users exceeding limit: ${results.usersExceedingLimit}`);
        console.log(`   Users successfully processed: ${results.usersProcessed}`);
        console.log(`   Total excess removed: ${results.totalExcessRemoved} DAN`);
        console.log(`   Total packages completed: ${results.totalPackagesCompleted}`);
        console.log(`   Errors: ${results.errors.length}`);
        
        if (results.errors.length > 0) {
            console.log('❌ ERRORS:');
            results.errors.forEach(error => console.log(`   - ${error}`));
        }
        
        console.log('✅ Earnings Limit Check completed');
        
    } catch (error) {
        console.error('❌ Fatal error in earnings limit check:', error);
        process.exit(1);
    }
};

// Run the cron job if this file is executed directly
if (require.main === module) {
    runEarningsLimitCheck()
        .then(() => {
            console.log('🏁 Cron job finished');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Cron job failed:', error);
            process.exit(1);
        });
}

module.exports = {
    runEarningsLimitCheck,
    checkUserEarningsLimit,
    processUserExceedingLimit,
    getTotalInvestmentFromPackages
};
