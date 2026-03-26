const router = require('express').Router();
const shippingController = require('../controllers/shipping.controller');
const { verifyToken } = require('../middleware/authMiddleware');

// Public routes
router.get('/track/:trackingNumber', shippingController.trackShipment);

// Customer routes
router.post('/calculate', verifyToken, shippingController.calculateShipping);
router.get('/my-shipments', verifyToken, shippingController.getCustomerShipments);
router.post('/:shippingId/rate', verifyToken, shippingController.submitRating);
router.post('/:shippingId/issue', verifyToken, shippingController.reportIssue);

// Vendor routes
router.post('/create/:orderId', shippingController.createShipping);
router.get('/vendor/shipments', shippingController.getVendorShipments);
router.post('/:shippingId/schedule-pickup', shippingController.schedulePickup);

// Courier/Admin routes
router.patch('/:shippingId/status', shippingController.updateStatus);
router.post('/:shippingId/delivery-attempt', shippingController.recordDeliveryAttempt);
router.post('/:shippingId/confirm-delivery', shippingController.confirmDelivery);
router.get('/:shippingId', shippingController.getShippingDetails);

module.exports = router;