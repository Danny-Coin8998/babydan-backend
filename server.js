const app = require('./app');

const PORT = process.env.PORT || 8001;

// Start server
app.listen(PORT, () => {
    console.log('');
    const isDev = process.env.MODE === 'development';
    const modeText = isDev ? '🔧 DEVELOPMENT' : '🚀 PRODUCTION';
    console.log(`📊 Environment: ${modeText} mode`);

    console.log(`🚀 Baby Dan Binary API Server running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/api/dashboard/1`);
    console.log(`💰 Investment: http://localhost:${PORT}/api/my-investment/1`);
    console.log(`👥 Direct Referrals: http://localhost:${PORT}/api/my-direct-referral/1`);
    console.log(`🌳 Team: http://localhost:${PORT}/api/my-team/1`);
    console.log(`📜 History: http://localhost:${PORT}/api/history/1`);
    console.log(`🔗 Referral Links: http://localhost:${PORT}/api/referral-link/1`);
});
