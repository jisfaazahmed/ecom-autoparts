const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refund.controller');

// Customer routes
router.post('/create/:orderItemId', refundController.createRefundRequest);
router.get('/my-refunds', refundController.getCustomerRefunds);
router.get('/:refundId', refundController.getRefundDetails);
router.post('/:refundId/quality-response', refundController.qualityCheckResponse);
router.post('/:refundId/feedback', refundController.submitFeedback);

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