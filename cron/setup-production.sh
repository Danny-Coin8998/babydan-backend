#!/bin/bash

# Production Setup Script for Baby Dan Binary Cron Jobs
# This script helps set up cron jobs in a production environment

echo "🚀 Baby Dan Binary Cron Jobs Production Setup"
echo "=============================================="

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "⚠️  Warning: Running as root. Consider using a dedicated user."
fi

# Get the current directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "📁 Project directory: $PROJECT_DIR"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm found: $(npm --version)"

# Check if .env file exists
if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "⚠️  .env file not found. Please create one with your database credentials."
    echo "   Example:"
    echo "   DB_HOST=localhost"
    echo "   DB_USER=your_db_user"
    echo "   DB_PASSWORD=your_db_password"
    echo "   DB_NAME=your_db_name"
    exit 1
fi

echo "✅ .env file found"

# Make cron scripts executable
chmod +x "$SCRIPT_DIR"/*.js
echo "✅ Made cron scripts executable"

# Test the cron job by running it once
echo "🧪 Testing earnings limit check..."
cd "$PROJECT_DIR"
if node cron/checkEarningsLimit.js; then
    echo "✅ Test passed"
else
    echo "❌ Test failed. Please check your database connection and configuration."
    exit 1
fi

# Ask user for setup preference
echo ""
echo "📋 Choose setup method:"
echo "1) System cron (recommended for production)"
echo "2) PM2 process manager"
echo "3) Manual setup instructions"
echo "4) Skip setup"

read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "🔧 Setting up system cron..."
        
        # Create cron entry
        CRON_ENTRY="0 0 * * * cd $PROJECT_DIR && node cron/checkEarningsLimit.js >> /var/log/baby-dan-cron.log 2>&1"
        
        # Add to crontab
        (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
        
        echo "✅ Added cron job: $CRON_ENTRY"
        echo "📝 Logs will be written to: /var/log/baby-dan-cron.log"
        echo "🔍 To view logs: tail -f /var/log/baby-dan-cron.log"
        echo "📋 To edit crontab: crontab -e"
        ;;
        
    2)
        echo "🔧 Setting up PM2..."
        
        # Check if PM2 is installed
        if ! command -v pm2 &> /dev/null; then
            echo "📦 Installing PM2..."
            npm install -g pm2
        fi
        
        # Create PM2 ecosystem file
        cat > "$PROJECT_DIR/ecosystem.config.js" << EOF
module.exports = {
  apps: [{
    name: 'baby-dan-cron',
    script: 'cron/scheduler.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/cron-error.log',
    out_file: './logs/cron-out.log',
    log_file: './logs/cron-combined.log',
    time: true
  }]
};
EOF
        
        # Create logs directory
        mkdir -p "$PROJECT_DIR/logs"
        
        # Start with PM2
        pm2 start "$PROJECT_DIR/ecosystem.config.js"
        pm2 save
        pm2 startup
        
        echo "✅ PM2 setup complete"
        echo "🔍 To monitor: pm2 logs baby-dan-cron"
        echo "🔄 To restart: pm2 restart baby-dan-cron"
        echo "⏹️  To stop: pm2 stop baby-dan-cron"
        ;;
        
    3)
        echo "📖 Manual Setup Instructions:"
        echo ""
        echo "1. System Cron (every midnight):"
        echo "   Add this line to your crontab (crontab -e):"
        echo "   0 0 * * * cd $PROJECT_DIR && node cron/checkEarningsLimit.js >> /var/log/baby-dan-cron.log 2>&1"
        echo ""
        echo "2. PM2 Process Manager:"
        echo "   Install PM2: npm install -g pm2"
        echo "   Start scheduler: pm2 start cron/scheduler.js --name baby-dan-cron"
        echo "   Save PM2 config: pm2 save"
        echo "   Setup startup: pm2 startup"
        echo ""
        echo "3. Docker:"
        echo "   Add to your Dockerfile:"
        echo "   COPY cron/ /app/cron/"
        echo "   CMD [\"node\", \"cron/scheduler.js\"]"
        echo ""
        echo "4. Manual Testing:"
        echo "   Run once: node cron/checkEarningsLimit.js"
        echo "   Start scheduler: npm run cron:schedule"
        ;;
        
    4)
        echo "⏭️  Skipping setup"
        ;;
        
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📚 Documentation: $SCRIPT_DIR/README.md"
echo "🚀 Run once: node cron/checkEarningsLimit.js"
echo "⏰ Start scheduler: npm run cron:schedule"
echo ""
echo "⚠️  Remember to:"
echo "   - Monitor logs regularly"
echo "   - Test in staging environment first"
echo "   - Backup database before first run"
echo "   - Set up monitoring and alerts"
