# Dan Binary API Server

A modular Node.js Express API server for the Dan Binary platform, providing RESTful endpoints for wallet-based authentication, dashboard data, investments, referrals, team management, and transaction history.

## 📁 Project Structure

```
dan-binary-server/
├── config/
│   └── database.js              # Database connection configuration
├── controllers/
│   ├── helpers.js               # Helper functions (converted from PHP)
│   ├── authController.js        # Wallet authentication logic
│   ├── dashboardController.js   # Dashboard logic
│   ├── investmentController.js  # Investment logic
│   ├── referralController.js    # Referral & team logic
│   └── historyController.js     # History logic
├── routes/
│   ├── auth.js                  # Authentication routes
│   ├── dashboard.js             # Dashboard routes
│   ├── investment.js            # Investment routes
│   ├── referral.js              # Referral routes
│   └── history.js               # History routes
├── middleware/
│   └── (future middleware files)
├── app.js                       # Main application setup
├── server.js                    # Server startup file
├── package.json
├── .env
└── README.md
```

## 🚀 Features

- **Wallet Authentication**: Web3 wallet-based authentication using ethers.js
- **JWT Tokens**: Secure session management with JWT tokens
- **Modular Architecture**: Separated controllers, routes, and configuration
- **Database Integration**: MySQL2 with connection pooling
- **Error Handling**: Comprehensive error handling and logging
- **CORS Support**: Cross-origin requests enabled
- **Environment Configuration**: Easy deployment with .env
- **Ethers.js v6**: Modern Web3 integration for wallet signatures
- **Automated Cron Jobs**: Earnings limit checking with PM2 process management
- **Production Ready**: PM2 ecosystem configuration for reliable deployment

## 📋 API Endpoints

### Authentication (Wallet-based)
- `GET /api/auth/nonce/:walletAddress` - Get nonce for wallet authentication
- `POST /api/auth/wallet-login` - Authenticate with wallet signature
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - User logout

### Protected Endpoints (Require JWT Token)
- `GET /api/dashboard` - Complete dashboard data
- `GET /api/my-investment` - Investment history
- `GET /api/my-direct-ref/direct` - Direct referrals
- `GET /api/my-team/team` - Team structure
- `GET /api/history` - Transaction history
- `GET /api/ref-link/link` - Referral links

## 🛠️ Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables in `.env`:**
   ```
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   JWT_EXPIRES_IN=7d
   DB_HOST=localhost
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_NAME=your_db_name
   PORT=8000
   ```

## 🚀 Production Deployment with PM2

### Overview
This project includes both an **API server** and **automated cron jobs** that run together using PM2 process manager. The system consists of:

1. **API Server** (`server.js`) - Handles all HTTP requests and API endpoints
2. **Cron Scheduler** (`cron/scheduler.js`) - Runs automated tasks every midnight to check earnings limits

### PM2 Ecosystem Configuration

The project includes an `ecosystem.config.js` file that defines both processes:

```javascript
module.exports = {
  apps: [
    {
      name: 'baby-dan-api',           // API Server
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true
    },
    {
      name: 'baby-dan-cron',          // Cron Scheduler
      script: 'cron/scheduler.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' },
      error_file: './logs/cron-error.log',
      out_file: './logs/cron-out.log',
      log_file: './logs/cron-combined.log',
      time: true
    }
  ]
};
```

### 🎯 Quick Start Commands

```bash
# Install PM2 globally (if not already installed)
npm install -g pm2

# Start both API and Cron with ecosystem file
pm2 start ecosystem.config.js

# Check status of both processes
pm2 status

# View logs for both processes
pm2 logs

# View logs for specific process
pm2 logs baby-dan-api
pm2 logs baby-dan-cron

# Restart both processes
pm2 restart all

# Stop both processes
pm2 stop all

# Delete both processes
pm2 delete all

# Save current PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
```

### 📊 What Each Process Does

#### **API Server (`baby-dan-api`)**
- **Purpose**: Handles all HTTP API requests
- **Port**: 8000 (configurable in server.js)
- **Endpoints**: All `/api/*` routes
- **Features**:
  - Wallet authentication
  - Dashboard data
  - Investment management
  - Transaction history
  - User management

#### **Cron Scheduler (`baby-dan-cron`)**
- **Purpose**: Runs automated background tasks
- **Schedule**: Every midnight (24 hours)
- **Tasks**:
  - Checks users whose earnings exceed 3x their investment
  - Creates deduction transactions for excess earnings
  - Marks active packages as completed
  - Maintains economic balance

### 🔄 How They Work Together

```
┌─────────────────────────────────────────────────────────────┐
│                    PM2 Process Manager                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │   API Server    │    │      Cron Scheduler            │ │
│  │  (baby-dan-api) │    │    (baby-dan-cron)             │ │
│  │                 │    │                                 │ │
│  │ • Handles HTTP  │    │ • Runs every midnight          │ │
│  │ • User requests │    │ • Checks earnings limits       │ │
│  │ • Authentication│    │ • Processes excess earnings    │ │
│  │ • Data queries  │    │ • Updates package status       │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 📈 Monitoring and Management

```bash
# Real-time monitoring dashboard
pm2 monit

# View detailed process information
pm2 show baby-dan-api
pm2 show baby-dan-cron

# View process logs in real-time
pm2 logs --follow

# Restart specific process
pm2 restart baby-dan-api
pm2 restart baby-dan-cron

# View process resource usage
pm2 list
```

### 🛠️ Development vs Production

#### **Development Mode**
```bash
# Run API server only (for development)
npm start
# or
npm run dev

# Run cron scheduler only (for testing)
npm run cron:schedule
```

#### **Production Mode**
```bash
# Run both API and Cron with PM2
pm2 start ecosystem.config.js

# This starts:
# - API server on port 8000
# - Cron scheduler running every midnight
```

### 📝 Log Management

Logs are automatically managed by PM2:

```
logs/
├── api-error.log      # API server errors
├── api-out.log        # API server output
├── api-combined.log   # API server combined logs
├── cron-error.log     # Cron scheduler errors
├── cron-out.log       # Cron scheduler output
└── cron-combined.log  # Cron scheduler combined logs
```

### 🔧 Troubleshooting

#### **API Server Issues**
```bash
# Check API logs
pm2 logs baby-dan-api

# Restart API server
pm2 restart baby-dan-api

# Check if port 8000 is available
lsof -i :8000
```

#### **Cron Scheduler Issues**
```bash
# Check cron logs
pm2 logs baby-dan-cron

# Restart cron scheduler
pm2 restart baby-dan-cron

# Run cron job manually for testing
node cron/checkEarningsLimit.js
```

#### **Port Already in Use**
```bash
# Kill process using port 8000
sudo lsof -ti:8000 | xargs kill -9

# Or change port in server.js
```

## 🎯 Development Usage

### Start Server (Development Only)
```bash
# Start server
npm start

# Development with auto-reload
npm run dev
```

## ⏰ Automated Cron Jobs

### Earnings Limit Check System

The system includes an automated cron job that runs every midnight to maintain economic balance by ensuring users don't earn more than 3x their total investment.

#### **What the Cron Job Does:**

1. **Scans All Users**: Checks every user who has investments
2. **Calculates Earnings**: Computes total earnings (APR + Binary + Referral + Commission)
3. **Calculates Investment**: Computes total investment amount
4. **Checks 3x Limit**: Verifies if earnings exceed 3x investment
5. **Processes Excess**: If exceeded, creates deduction transaction and completes packages

#### **Cron Job Flow:**

```
Every Midnight (00:00):
┌─────────────────────────────────────────────────────────────┐
│ 1. Get all users with investments                          │
│ 2. For each user:                                          │
│    ├── Calculate total_earned (APR + Binary + Referral)    │
│    ├── Calculate total_investment                          │
│    ├── Check if total_earned > 3 × total_investment        │
│    └── If YES:                                             │
│        ├── Create deduction transaction                    │
│        ├── Remove excess earnings                          │
│        └── Mark all active packages as COMPLETED           │
└─────────────────────────────────────────────────────────────┘
```

#### **Example Scenario:**

```
User Investment: 1000 DAN
User Earnings: 4500 DAN
3x Limit: 3000 DAN
Excess: 500 DAN

Action Taken:
- Deduct 500 DAN from user balance
- Mark all active packages as COMPLETED
- User now has exactly 3000 DAN (3x investment)
```

#### **Cron Job Files:**

- `cron/checkEarningsLimit.js` - Main cron job logic
- `cron/scheduler.js` - Scheduler that runs the job every 24 hours
- `ecosystem.config.js` - PM2 configuration for both API and cron

#### **Manual Cron Commands:**

```bash
# Run cron job once (for testing)
node cron/checkEarningsLimit.js

# Start cron scheduler (runs every midnight)
npm run cron:schedule

# List available cron jobs
node cron/scheduler.js list

# Run specific cron job once
node cron/scheduler.js run earningsLimitCheck
```

## 🔐 Wallet Authentication

### Authentication Flow

1. **Get Nonce from Backend:**
   ```javascript
   const response = await fetch('http://localhost:8000/api/auth/nonce/0x742d35Cc6634C0532925a3b8D0C4e4C4e4C4e4C4e');
   const { nonce } = await response.json();
   ```

2. **Sign Message with Wallet:**
   ```javascript
   const provider = new ethers.BrowserProvider(window.ethereum);
   const signer = await provider.getSigner();
   const signature = await signer.signMessage(nonce);
   ```

3. **Authenticate with Backend:**
   ```javascript
   const response = await fetch('http://localhost:8000/api/auth/wallet-login', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       walletAddress: '0x742d35Cc6634C0532925a3b8D0C4e4C4e4C4e4C4e',
       signature: signature,
       message: nonce
     })
   });
   ```

### JWT Token Structure

The JWT token contains:
```json
{
  "userid": 123,
  "iat": 1640995200,
  "exp": 1641600000,
  "iss": "baby-dan-binary-api",
  "aud": "baby-dan-binary-frontend"
}
```

## 🧪 Testing

### Test Wallet Authentication

1. **Get Nonce:**
   ```bash
   curl -X GET "http://localhost:8000/api/auth/nonce/0x742d35Cc6634C0532925a3b8D0C4e4C4e4C4e4C4e"
   ```

2. **Wallet Login:**
   ```bash
   curl -X POST "http://localhost:8000/api/auth/wallet-login" \
     -H "Content-Type: application/json" \
     -d '{
       "walletAddress": "0x742d35Cc6634C0532925a3b8D0C4e4C4e4C4e4C4e",
       "signature": "0x1234567890abcdef...",
       "message": "a1b2c3d4e5f6789012345678901234567890abcd"
     }'
   ```

3. **Verify Token:**
   ```bash
   curl -X GET "http://localhost:8000/api/auth/verify" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

## 📊 Response Format

All API responses follow this format:

**Success Response:**
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## 🌐 Frontend Integration

### Complete Authentication Class

```javascript
class DanBinaryAuth {
  constructor(apiBaseUrl = 'http://localhost:8000/api') {
    this.apiBaseUrl = apiBaseUrl;
    this.token = localStorage.getItem('authToken');
  }

  // Connect to wallet
  async connectWallet() {
    if (!window.ethereum) {
      throw new Error('No wallet provider found. Please install MetaMask.');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    
    if (accounts.length === 0) {
      throw new Error('No accounts found. Please connect your wallet.');
    }

    return accounts[0];
  }

  // Get nonce from backend
  async getNonce(walletAddress) {
    const response = await fetch(`${this.apiBaseUrl}/auth/nonce/${walletAddress}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    return data.nonce;
  }

  // Sign message with wallet
  async signMessage(message) {
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return await signer.signMessage(message);
  }

  // Authenticate with backend
  async authenticate(walletAddress, signature, message) {
    const response = await fetch(`${this.apiBaseUrl}/auth/wallet-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress, signature, message })
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    this.token = data.token;
    localStorage.setItem('authToken', data.token);
    return data;
  }

  // Complete login flow
  async login() {
    const walletAddress = await this.connectWallet();
    const nonce = await this.getNonce(walletAddress);
    const signature = await this.signMessage(nonce);
    return await this.authenticate(walletAddress, signature, nonce);
  }

  // Make authenticated requests
  async makeAuthenticatedRequest(endpoint, options = {}) {
    if (!this.token) {
      throw new Error('No authentication token found. Please login first.');
    }

    const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (response.status === 401) {
      this.logout();
      throw new Error('Session expired. Please login again.');
    }

    return await response.json();
  }

  // API Methods
  async getUserData() {
    return await this.makeAuthenticatedRequest('/auth/verify');
  }

  async getDashboard() {
    return await this.makeAuthenticatedRequest('/dashboard');
  }

  async getInvestment() {
    return await this.makeAuthenticatedRequest('/my-investment');
  }

  async getReferrals() {
    return await this.makeAuthenticatedRequest('/my-direct-ref/direct');
  }

  async getTeam() {
    return await this.makeAuthenticatedRequest('/my-team/team');
  }

  async getHistory() {
    return await this.makeAuthenticatedRequest('/history');
  }

  async getReferralLink() {
    return await this.makeAuthenticatedRequest('/ref-link/link');
  }

  // Logout
  logout() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  // Check authentication status
  isAuthenticated() {
    return !!this.token;
  }
}

// Usage
const auth = new DanBinaryAuth('http://localhost:8000/api');

// Login
document.getElementById('loginButton').addEventListener('click', async () => {
  try {
    const result = await auth.login();
    console.log('Login successful:', result);
    window.location.href = '/dashboard';
  } catch (error) {
    console.error('Login failed:', error);
    alert('Login failed: ' + error.message);
  }
});
```

## 🔧 Development

### Adding New Endpoints

1. **Create Controller:**
   ```javascript
   // controllers/newController.js
   const newFunction = async (req, res) => {
       // Implementation
   };
   
   module.exports = { newFunction };
   ```

2. **Create Route:**
   ```javascript
   // routes/new.js
   const express = require('express');
   const router = express.Router();
   const { newFunction } = require('../controllers/newController');
   
   router.get('/', authenticateToken, newFunction);
   module.exports = router;
   ```

3. **Add to App:**
   ```javascript
   // app.js
   const newRoutes = require('./routes/new');
   app.use('/api/new', newRoutes);
   ```

## 🗄️ Database Schema

The API connects to the existing Dan Binary MySQL database with these key tables:
- `members` - User accounts with wallet addresses
- `member_invest` - Investment records
- `wallet_cash_transactions` - Financial transactions
- `packages` - Investment packages
- `members_login_logs` - Login tracking

## 🔒 Security Features

- **Wallet Signatures**: All signatures verified using ethers.js v6
- **JWT Tokens**: Secure session management with 7-day expiration
- **Nonce Security**: Server-generated nonces prevent replay attacks
- **Address Validation**: Robust Ethereum address validation
- **IP Tracking**: Login attempts are logged with IP addresses
- **Error Handling**: Comprehensive error handling without exposing sensitive data

## 📝 License

ISC
