const express = require('express');
const router = express.Router();
const adminAnalyticsController = require('../controllers/adminAnalyticsController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// GET /api/admin-analytics/superadmin
router.get('/superadmin', verifyToken, isSuperAdmin, adminAnalyticsController.getSuperAdminAnalytics);

module.exports = router;
