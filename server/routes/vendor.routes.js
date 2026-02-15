const express = require('express');
const VendorController = require('../controllers/vendorApproval.controller');

const router = express.Router();

/**
 * Vendor Routes
 */

// Get vendor statistics (must be before /:id to avoid route conflict)
router.get('/stats', VendorController.getVendorStats);

// Get all vendors (with optional filters)
router.get('/', VendorController.getAllVendors);

// Get vendor by ID
router.get('/:id', VendorController.getVendorById);

// Create new vendor (vendor registration)
router.post('/', VendorController.createVendor);

// Approve vendor (admin action)
router.put('/:id/approve', VendorController.approveVendor);

// Reject vendor (admin action)
router.put('/:id/reject', VendorController.rejectVendor);

// Suspend vendor (admin action)
router.put('/:id/suspend', VendorController.suspendVendor);

// Update vendor commission rate (admin action)
router.put('/:id/commission', VendorController.updateCommissionRate);

// Delete vendor (for development/testing)
router.delete('/:id', VendorController.deleteVendor);

module.exports = router;