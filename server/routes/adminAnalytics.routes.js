const express = require('express');
const router = express.Router();
const adminAnalyticsController = require('../controllers/adminAnalyticsController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// Simple in-memory rate limiter for AI queries: 10 requests per minute per user
const askRateLimitStore = {};
const askRateLimiter = (req, res, next) => {
  const userId = req.user?.id || req.ip;
  const now = Date.now();

  if (!askRateLimitStore[userId]) {
    askRateLimitStore[userId] = [];
  }

  // Filter out request timestamps older than 60 seconds
  askRateLimitStore[userId] = askRateLimitStore[userId].filter(time => now - time < 60000);

  if (askRateLimitStore[userId].length >= 10) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. You can ask up to 10 questions per minute. Please wait.'
    });
  }

  askRateLimitStore[userId].push(now);
  next();
};

// GET /api/admin-analytics/superadmin
router.get('/superadmin', verifyToken, isSuperAdmin, adminAnalyticsController.getSuperAdminAnalytics);

// POST /api/admin-analytics/superadmin/ask
router.post('/superadmin/ask', verifyToken, isSuperAdmin, askRateLimiter, adminAnalyticsController.askAnalyticsAI);

module.exports = router;
