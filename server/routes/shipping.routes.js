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
router.post('/create/:orderId', verifyToken, shippingController.createShipping);
router.get('/vendor/shipments', verifyToken, shippingController.getVendorShipments);
router.post('/:shippingId/schedule-pickup', verifyToken, shippingController.schedulePickup);

// Courier/Admin routes
router.patch('/:shippingId/status', verifyToken, shippingController.updateStatus);
router.post('/:shippingId/delivery-attempt', verifyToken, shippingController.recordDeliveryAttempt);
router.post('/:shippingId/confirm-delivery', verifyToken, shippingController.confirmDelivery);
router.get('/:shippingId', verifyToken, shippingController.getShippingDetails);

module.exports = router;