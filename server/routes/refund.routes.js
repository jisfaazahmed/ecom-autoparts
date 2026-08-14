const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refund.controller');
const { verifyToken } = require('../middleware/authMiddleware');

// Customer routes
router.post('/', verifyToken, refundController.createRefundRequestByOrder);
router.post('/create/:orderItemId', verifyToken, refundController.createRefundRequest);
router.get('/my-refunds', verifyToken, refundController.getCustomerRefunds);

// Vendor routes
router.get('/vendor/refunds', verifyToken, refundController.getVendorRefunds);
router.post('/:refundId/review', verifyToken, refundController.vendorReviewRefund);

// Admin/Courier routes
router.put('/:refundId/approve', verifyToken, refundController.approveOrRejectRefund);
router.patch('/:refundId/return-status', verifyToken, refundController.updateReturnStatus);
router.patch('/:refundId/return-shipping', verifyToken, refundController.updateReturnShipping);

// Admin routes
router.get('/admin/list', verifyToken, refundController.getAdminRefunds);
router.post('/:refundId/quality-check', verifyToken, refundController.conductQualityCheck);
router.post('/:refundId/dispute', verifyToken, refundController.handleDispute);
router.get('/admin/statistics', verifyToken, refundController.getRefundStatistics);

// Customer detail/update routes - keep after static paths
router.get('/:refundId', verifyToken, refundController.getRefundDetails);
router.post('/:refundId/quality-response', verifyToken, refundController.qualityCheckResponse);
router.post('/:refundId/feedback', verifyToken, refundController.submitFeedback);

module.exports = router;