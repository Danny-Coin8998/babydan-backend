const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import routes
const dashboardRoutes = require('./routes/dashboard');
const investmentRoutes = require('./routes/investment');
const referralRoutes = require('./routes/referral');
const teamRoutes = require('./routes/team');
const refLinkRoutes = require('./routes/refLink');
const historyRoutes = require('./routes/history');
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const packagesRoutes = require('./routes/packages');
const depositRoutes = require('./routes/deposit');
const buyPackageRoutes = require('./routes/buyPackage');
const profileRoutes = require('./routes/profile');
const withdrawRoutes = require('./routes/withdraw');
const transferRoutes = require('./routes/transfer');

// Import database connection
const { testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 8001;

const isDev = process.env.MODE !== 'production';
const parseList = v => (v || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)
  .map(s => s.replace(/\/+$/, '')); // strip trailing slash

const devOrigins = parseList(process.env.DEV_BASE_URLS); // e.g. http://localhost:3000,http://127.0.0.1:3000
const prodOrigins = parseList(process.env.BASE_URL_LIST);      // e.g. https://danstaking.com,https://dan-binary.vercel.app

const corsOptions = {
  origin(origin, cb) {
    const allowed = isDev ? [...devOrigins, ...prodOrigins] : prodOrigins;
    const normalizedOrigin = (origin || '').replace(/\/+$/, '');
    console.log(`[CORS] Incoming Origin: ${origin} | Allowed: ${allowed.join(' , ')}`);

    if (!origin) {
      // Allow Postman/curl only in dev; block in prod
      return isDev ? cb(null, true) : cb(new Error('Origin required'));
    }

    return allowed.includes(normalizedOrigin)
      ? cb(null, true)
      : cb(new Error('Not allowed by CORS'));
  },
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Log incoming origins/referrers (place before CORS and routes)
app.use((req, res, next) => {
  const origin = req.headers.origin || '(no Origin header)';
  const referer = req.headers.referer || '(no Referer header)';
  const host = req.headers.host || '(no Host)';
  console.log(`[REQ] ${req.method} ${req.path} | Origin: ${origin} | Referer: ${referer} | Host: ${host} | IP: ${req.ip}`);
  next();
});

// Test database connection
testConnection();

// Routes
app.get('/v2', (req, res) => {
    res.json({ 
        message: 'Baby Dan API Server is running!',
        version: '1.0.0',
        endpoints: {
            auth: {
                login: 'POST /v2/api/auth/login',
                logout: 'POST /v2/api/auth/logout',
                test: 'GET /v2/api/auth/test/:userid'
            },
            dashboard: 'GET /v2/api/dashboard/',
            investment: 'GET /v2/api/my-investment/',
            directReferral: 'GET /v2/api/my-direct-referral/direct',
            team: 'GET /v2/api/my-team/team',
            history: 'GET /v2/api/history/',
            referralLink: 'GET /v2/api/ref-link/link'
        }
    });
});

// API Routes
app.use('/v2/api/auth', authRoutes);
app.use('/v2/api/dashboard', dashboardRoutes);
app.use('/v2/api/my-investment', investmentRoutes);
app.use('/v2/api/my-direct-ref', referralRoutes);
app.use('/v2/api/my-team', teamRoutes);
app.use('/v2/api/history', historyRoutes);
app.use('/v2/api/ref-link', refLinkRoutes);
app.use('/v2/api/get-balance', walletRoutes);
app.use('/v2/api/get-packages', packagesRoutes);
app.use('/v2/api/deposit', depositRoutes);
app.use('/v2/api/buy-package', buyPackageRoutes);
app.use('/v2/api/profile', profileRoutes);
app.use('/v2/api/withdraw', withdrawRoutes);
app.use('/v2/api/transfer', transferRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found'+res });
});

module.exports = app;
