const router = require('express').Router();
const shippingController = require('../controllers/shipping.controller');
const { verifyToken } = require('../middleware/authMiddleware');
const {
	validateTrackingNumber,
	validateShippingCalculate,
	validateSubmitRating,
	validateReportIssue,
	validateObjectIdParam,
	validateShippingStatusUpdate,
	validateDeliveryAttempt,
	validatePaginationQuery,
} = require('../middleware/requestValidators');

// Public routes
router.get('/track/:trackingNumber', validateTrackingNumber, shippingController.trackShipment);

// Customer routes
router.post('/calculate', verifyToken, validateShippingCalculate, shippingController.calculateShipping);
router.get('/my-shipments', verifyToken, validatePaginationQuery, shippingController.getCustomerShipments);
router.post('/:shippingId/rate', verifyToken, validateSubmitRating, shippingController.submitRating);
router.post('/:shippingId/issue', verifyToken, validateReportIssue, shippingController.reportIssue);

// Vendor routes
router.post('/create/:orderId', verifyToken, validateObjectIdParam('orderId', 'orderId'), shippingController.createShipping);
router.get('/vendor/shipments', verifyToken, validatePaginationQuery, shippingController.getVendorShipments);
router.post('/:shippingId/schedule-pickup', verifyToken, validateObjectIdParam('shippingId', 'shippingId'), shippingController.schedulePickup);

// Courier/Admin routes
router.patch('/:shippingId/status', verifyToken, validateShippingStatusUpdate, shippingController.updateStatus);
router.post('/:shippingId/delivery-attempt', verifyToken, validateDeliveryAttempt, shippingController.recordDeliveryAttempt);
router.post('/:shippingId/confirm-delivery', verifyToken, validateObjectIdParam('shippingId', 'shippingId'), shippingController.confirmDelivery);
router.post('/:shippingId/generate-label', verifyToken, validateObjectIdParam('shippingId', 'shippingId'), shippingController.generateShippingLabel);
router.get('/:shippingId', verifyToken, validateObjectIdParam('shippingId', 'shippingId'), shippingController.getShippingDetails);

module.exports = router;