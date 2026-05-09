const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

<<<<<<< HEAD
=======
// ========== VENDOR MANAGEMENT (Superadmin only) ==========
>>>>>>> origin/feature/seller
// Protect these routes!
router.use(verifyToken, isSuperAdmin);

router.get('/', vendorController.getAllVendors);
router.patch('/:id/status', vendorController.updateVendorStatus);
<<<<<<< HEAD
=======
router.patch('/:id/commission', vendorController.updateVendorCommission);

// ========== ANALYTICS ENDPOINTS ==========
router.get('/:id/analytics', vendorController.getVendorAnalytics);
router.get('/:id/analytics/timeseries', vendorController.getTimeSeriesAnalytics);
router.get('/:id/analytics/earnings', vendorController.getEarningsBreakdown);
router.get('/:id/settlements/summary', vendorController.getVendorSettlementRangeSummary);

// ========== SETTLEMENT / PAYOUT ENDPOINTS ==========
router.get('/:id/settlement/summary', vendorController.getSettlementSummary);
router.get('/:id/settlements', vendorController.getVendorSettlements);
router.get('/:id/payable', vendorController.getTotalPayable);
router.post('/:id/settlement/create', vendorController.createVendorSettlement);
router.post('/settlement/process-all', vendorController.processAutomatedSettlements);
>>>>>>> origin/feature/seller

module.exports = router;