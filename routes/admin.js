const express = require('express');
const router = express.Router();
const { getDailyInvest, adminInvest } = require('../controllers/adminController');

// GET /admin/daily-invest
router.get('/daily-invest', getDailyInvest);
router.post('/invest', adminInvest);

module.exports = router;


