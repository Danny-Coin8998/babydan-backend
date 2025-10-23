# Cron Jobs for Baby Dan Binary Backend

This directory contains automated cron jobs for the Baby Dan Binary platform.

## Available Cron Jobs

### 1. Earnings Limit Check (`checkEarningsLimit.js`)

**Purpose**: Monitors users whose total earnings exceed 3x their total investment and automatically adjusts their accounts.

**What it does**:
- Checks all users with investments
- Calculates `total_earned` (APR + Binary + Referral APR + Commission)
- Calculates `total_investment` (all investments)
- If `total_earned > 3 * total_investment`:
  - Creates a deduction transaction to remove excess earnings
  - Marks all active packages as `COMPLETED`
  - Logs all actions for audit purposes

**Frequency**: Every 24 hours (midnight) (configurable)

## Usage

### Running Individual Jobs

```bash
# Run earnings limit check once
node cron/checkEarningsLimit.js
```

### Running the Scheduler

```bash
# Start the scheduler (runs all enabled jobs)
npm run cron:schedule

# Or directly
node cron/scheduler.js
```

### Scheduler Commands

```bash
# List available jobs
node cron/scheduler.js list

# Run a specific job once
node cron/scheduler.js run earningsLimitCheck

# Start the full scheduler
node cron/scheduler.js
```

## Configuration

### Environment Variables

Make sure these are set in your `.env` file:

```env
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
```

### Job Configuration

Edit `cron/scheduler.js` to modify job intervals and enable/disable jobs:

```javascript
const CRON_JOBS = {
    earningsLimitCheck: {
        name: 'Earnings Limit Check',
        interval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds (midnight)
        enabled: true,
        function: runEarningsLimitCheck
    }
};
```

## System Requirements

- Node.js 14+
- MySQL database
- Required npm packages (see main package.json)

## Database Tables Used

- `members` - User information
- `member_invest` - Investment records
- `wallet_cash_transactions` - All financial transactions
- `mlmpvhistory` - MLM PV history (for reference)

## Logging

All cron jobs provide detailed logging:
- ✅ Success messages
- ⚠️ Warning messages
- ❌ Error messages
- 📊 Summary statistics

## Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start the scheduler with PM2
pm2 start cron/scheduler.js --name "baby-dan-cron"

# Monitor
pm2 logs baby-dan-cron

# Stop
pm2 stop baby-dan-cron
```

### Using System Cron

Add to your crontab (`crontab -e`):

```bash
# Run earnings check every midnight
0 0 * * * cd /path/to/baby-dan-binary-backend && node cron/checkEarningsLimit.js >> /var/log/baby-dan-cron.log 2>&1
```

### Using Docker

```dockerfile
# Add to your Dockerfile
COPY cron/ /app/cron/
RUN chmod +x /app/cron/*.js

# Run in container
CMD ["node", "cron/scheduler.js"]
```

## Monitoring

### Health Checks

The cron jobs include built-in error handling and logging. Monitor the logs for:
- Successful job completions
- User processing statistics
- Error messages and stack traces

### Database Monitoring

Monitor these queries to track cron job effectiveness:

```sql
-- Users who have been processed (have earnings cap adjustments)
SELECT COUNT(*) FROM wallet_cash_transactions 
WHERE tran_type = 'Earnings Cap Adjustment';

-- Recently completed packages
SELECT COUNT(*) FROM member_invest 
WHERE status = 'COMPLETED' 
AND admin_msg LIKE '%earnings cap%'
AND admin_datetime > DATE_SUB(NOW(), INTERVAL 1 DAY);
```

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check `.env` file configuration
   - Verify database server is running
   - Check network connectivity

2. **Permission Errors**
   - Ensure Node.js has read/write access to log files
   - Check file permissions on cron scripts

3. **Memory Issues**
   - Monitor memory usage during large batch processing
   - Consider processing users in smaller batches

### Debug Mode

Run with debug logging:

```bash
DEBUG=baby-dan-cron node cron/checkEarningsLimit.js
```

## Security Considerations

- Cron jobs run with system privileges
- Ensure database credentials are secure
- Monitor logs for suspicious activity
- Use environment variables for sensitive data
- Consider running in isolated containers

## Adding New Cron Jobs

1. Create a new file in the `cron/` directory
2. Export a main function that can be called
3. Add the job to `CRON_JOBS` in `scheduler.js`
4. Run specific job with `node cron/scheduler.js run <jobName>`
5. Add to package.json scripts if needed

Example:

```javascript
// cron/newJob.js
const newJob = async () => {
    console.log('Running new job...');
    // Your job logic here
};

module.exports = { newJob };
```

```javascript
// Add to scheduler.js CRON_JOBS
newJob: {
    name: 'New Job',
    interval: 24 * 60 * 60 * 1000, // 24 hours
    enabled: true,
    function: require('./newJob').newJob
}
```
