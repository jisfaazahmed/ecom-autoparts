const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refund.controller');
const { verifyToken } = require('../middleware/authMiddleware');

// Customer routes
router.post('/create/:orderItemId', verifyToken, refundController.createRefundRequest);
router.get('/my-refunds', verifyToken, refundController.getCustomerRefunds);
router.get('/:refundId', verifyToken, refundController.getRefundDetails);
router.post('/:refundId/quality-response', verifyToken, refundController.qualityCheckResponse);
router.post('/:refundId/feedback', verifyToken, refundController.submitFeedback);

// Vendor routes
router.get('/vendor/refunds', refundController.getVendorRefunds);
router.post('/:refundId/review', refundController.vendorReviewRefund);

// Courier/Admin routes
router.patch('/:refundId/return-shipping', refundController.updateReturnShipping);

// Admin routes
router.post('/:refundId/quality-check', refundController.conductQualityCheck);
router.post('/:refundId/dispute', refundController.handleDispute);
router.get('/admin/statistics', refundController.getRefundStatistics);

module.exports = router;