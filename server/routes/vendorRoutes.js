const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// Protect these routes!
router.use(verifyToken, isSuperAdmin);

router.get('/', vendorController.getAllVendors);
router.patch('/:id/status', vendorController.updateVendorStatus);

module.exports = router;