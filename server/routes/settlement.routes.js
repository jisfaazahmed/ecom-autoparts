const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// All settlement endpoints require superadmin auth
router.use(verifyToken, isSuperAdmin);

// GET settlement by ID
router.get('/:settlementId', vendorController.getSettlementDetails);

// PATCH update settlement status (e.g., pending -> processing -> completed)
router.patch('/:settlementId/status', vendorController.updateSettlementStatus);

// POST process automated settlements for all vendors for a given period
router.post('/process/all', vendorController.processAutomatedSettlements);

module.exports = router;
