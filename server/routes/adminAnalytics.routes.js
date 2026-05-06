const express = require('express');
const router = express.Router();
const adminAnalyticsController = require('../controllers/adminAnalyticsController');
const { protect, authorize } = require('../middleware/auth.middleware');

// GET /api/admin-analytics/superadmin
router.get('/superadmin', protect, authorize(['superadmin']), adminAnalyticsController.getSuperAdminAnalytics);

module.exports = router;
