const express = require('express');
const router = express.Router();
const { verifyToken, requireVendor } = require('../middleware/authMiddleware');
const vendorDashboardController = require('../controllers/vendorDashboardController');

router.get(
  '/stats',
  verifyToken,
  requireVendor,
  vendorDashboardController.getVendorDashboardStats
);

module.exports = router;
