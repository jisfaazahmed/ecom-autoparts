const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { verifyToken, isSuperAdmin, requireVendor } = require('../middleware/authMiddleware');
const { validateObjectIdParam } = require('../middleware/requestValidators');

// ========== SELLER SELF-SERVICE ==========
// Declared before the superadmin guard below so sellers can reach their own
// payouts. Literal /my/* paths come before /my/:settlementId, and the whole
// block comes before /:settlementId, so nothing here is shadowed.
router.get('/my/summary', verifyToken, requireVendor, vendorController.getMySettlementSummary);
router.get('/my/payable', verifyToken, requireVendor, vendorController.getMyPayable);
router.get('/my/earnings', verifyToken, requireVendor, vendorController.getMyEarningsBreakdown);
router.get(
  '/my/:settlementId',
  verifyToken,
  requireVendor,
  validateObjectIdParam('settlementId', 'settlementId'),
  vendorController.getMySettlementDetails
);
router.get('/my', verifyToken, requireVendor, vendorController.getMySettlements);

// ========== SUPERADMIN ==========
// All remaining settlement endpoints require superadmin auth
router.use(verifyToken, isSuperAdmin);

// GET settlement by ID
router.get('/:settlementId', vendorController.getSettlementDetails);

// PATCH update settlement status (e.g., pending -> processing -> completed)
router.patch('/:settlementId/status', vendorController.updateSettlementStatus);

// POST process automated settlements for all vendors for a given period
router.post('/process/all', vendorController.processAutomatedSettlements);

module.exports = router;
