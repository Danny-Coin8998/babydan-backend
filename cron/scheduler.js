#!/usr/bin/env node

/**
 * Cron Scheduler for Baby Dan Binary Backend
 * 
 * This scheduler runs various cron jobs at specified intervals:
 * - Earnings Limit Check: Every 24 hours (midnight)
 * - Can be extended to include other cron jobs
 * 
 * Run with: npm run cron:schedule
 * Or: node cron/scheduler.js
 * 
 * Testing:
 * - To test earnings limit check every 5 minutes, uncomment the 
 *   earningsLimitCheckTest job and set enabled: true
 */

require('dotenv').config();
const { runEarningsLimitCheck } = require('./checkEarningsLimit');

// Cron job configurations
const CRON_JOBS = {
    // earningsLimitCheck: {
    //     name: 'Earnings Limit Check',
    //     interval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds (midnight to midnight)
    //     enabled: true,
    //     function: runEarningsLimitCheck,
    //     runAtMidnight: true // Special flag for midnight scheduling
    // },
    // Test version - runs every 5 minutes (commented out for production)
    // To enable for testing: uncomment the block below and set enabled: true
    earningsLimitCheckTest: {
        name: 'Earnings Limit Check (Test)',
        interval: 5 * 60 * 1000, // 5 minutes in milliseconds (for testing)
        enabled: true,
        function: runEarningsLimitCheck
    }
    // Add more cron jobs here as needed
    // exampleJob: {
    //     name: 'Example Job',
    //     interval: 24 * 60 * 60 * 1000, // 24 hours
    //     enabled: false,
    //     function: exampleFunction
    // }
};

/**
 * Run a single cron job
 */
const runCronJob = async (jobName, jobConfig) => {
    const startTime = Date.now();
    console.log(`\n🕐 Starting ${jobConfig.name} at ${new Date().toISOString()}`);
    
    try {
        await jobConfig.function();
        const duration = Date.now() - startTime;
        console.log(`✅ ${jobConfig.name} completed successfully in ${duration}ms`);
    } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`❌ ${jobConfig.name} failed after ${duration}ms:`, error.message);
    }
};

/**
 * Calculate milliseconds until next midnight
 */
const getMillisecondsUntilMidnight = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // Next midnight
    return midnight.getTime() - now.getTime();
};

/**
 * Schedule all enabled cron jobs
 */
const scheduleCronJobs = () => {
    console.log('🚀 Baby Dan Binary Cron Scheduler Started');
    console.log(`📅 Started at: ${new Date().toISOString()}`);
    console.log('─'.repeat(60));
    
    const scheduledJobs = [];
    
    // Schedule each enabled job
    Object.entries(CRON_JOBS).forEach(([jobName, jobConfig]) => {
        if (jobConfig.enabled) {
            if (jobConfig.runAtMidnight) {
                console.log(`⏰ Scheduling ${jobConfig.name} at midnight (24-hour intervals)`);
                
                // Calculate time until next midnight
                const msUntilMidnight = getMillisecondsUntilMidnight();
                console.log(`⏳ Next run in ${Math.round(msUntilMidnight / (60 * 1000))} minutes`);
                
                // Schedule first run at midnight
                const midnightTimeout = setTimeout(() => {
                    runCronJob(jobName, jobConfig);
                    
                    // Then schedule every 24 hours
                    const intervalId = setInterval(() => {
                        runCronJob(jobName, jobConfig);
                    }, jobConfig.interval);
                    
                    scheduledJobs.push({
                        name: jobConfig.name,
                        intervalId,
                        interval: jobConfig.interval
                    });
                }, msUntilMidnight);
                
                scheduledJobs.push({
                    name: jobConfig.name,
                    intervalId: midnightTimeout,
                    interval: jobConfig.interval
                });
            } else {
                console.log(`⏰ Scheduling ${jobConfig.name} every ${jobConfig.interval / (60 * 1000)} minutes`);
                
                // Run immediately on startup
                runCronJob(jobName, jobConfig);
                
                // Schedule recurring execution
                const intervalId = setInterval(() => {
                    runCronJob(jobName, jobConfig);
                }, jobConfig.interval);
                
                scheduledJobs.push({
                    name: jobConfig.name,
                    intervalId,
                    interval: jobConfig.interval
                });
            }
        } else {
            console.log(`⏸️  ${jobConfig.name} is disabled`);
        }
    });
    
    console.log(`\n📊 Scheduled ${scheduledJobs.length} cron jobs`);
    console.log('🔄 Scheduler is running... Press Ctrl+C to stop');
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down cron scheduler...');
        
        scheduledJobs.forEach(job => {
            if (job.intervalId) {
                clearInterval(job.intervalId);
                clearTimeout(job.intervalId); // Handle both intervals and timeouts
                console.log(`⏹️  Stopped ${job.name}`);
            }
        });
        
        console.log('👋 Cron scheduler stopped');
        process.exit(0);
    });
    
    // Keep the process alive
    process.on('uncaughtException', (error) => {
        console.error('💥 Uncaught Exception:', error);
        process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
        console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
        process.exit(1);
    });
};

/**
 * Run a specific job once (for testing)
 */
const runJobOnce = (jobName) => {
    const jobConfig = CRON_JOBS[jobName];
    if (!jobConfig) {
        console.error(`❌ Job '${jobName}' not found`);
        console.log('Available jobs:', Object.keys(CRON_JOBS).join(', '));
        process.exit(1);
    }
    
    console.log(`🧪 Running ${jobConfig.name} once...`);
    runCronJob(jobName, jobConfig)
        .then(() => {
            console.log('✅ Job completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Job failed:', error);
            process.exit(1);
        });
};

// Command line argument handling
const args = process.argv.slice(2);

if (args.length > 0) {
    const command = args[0];
    
    switch (command) {
        case 'run':
            if (args[1]) {
                runJobOnce(args[1]);
            } else {
                console.log('Usage: node cron/scheduler.js run <jobName>');
                console.log('Available jobs:', Object.keys(CRON_JOBS).join(', '));
                process.exit(1);
            }
            break;
            
        case 'list':
            console.log('📋 Available Cron Jobs:');
            Object.entries(CRON_JOBS).forEach(([name, config]) => {
                console.log(`   ${name}: ${config.name} (${config.enabled ? 'enabled' : 'disabled'})`);
            });
            process.exit(0);
            break;
            
        default:
            console.log('Usage:');
            console.log('  node cron/scheduler.js              # Start scheduler');
            console.log('  node cron/scheduler.js run <job>    # Run job once');
            console.log('  node cron/scheduler.js list         # List available jobs');
            process.exit(1);
    }
} else {
    // Start the scheduler
    scheduleCronJobs();
}

module.exports = {
    scheduleCronJobs,
    runJobOnce,
    CRON_JOBS
};
