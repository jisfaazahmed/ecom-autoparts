const router = require('express').Router();
const orderController = require('../controllers/order.controller');
const { verifyToken, attachUserIfPresent } = require('../middleware/authMiddleware');

//customer (guest checkout allowed)
router.post('/', attachUserIfPresent, orderController.createOrder);
router.get('/my_orders', verifyToken, orderController.getAllOrders);
router.get('/admin/all', verifyToken, orderController.getPlatformOrders);

// Guest order recovery (for newly registered users)
router.post('/recover-guest', verifyToken, orderController.recoverGuestOrders);

//vendor
router.get('/vendor/orders', verifyToken, orderController.getVendorOrders);
router.get('/seller/orders', verifyToken, orderController.getVendorOrders);
router.get('/seller/sub-orders', verifyToken, orderController.getMySubOrders);
router.patch('/:id/item-status', verifyToken, orderController.updateOrderStatus);

//track
router.get('/track/:trackingNumber', orderController.trackOrder);

//customer order details
router.get('/:id', verifyToken, orderController.getOrderById);
router.post('/:id/cancel', verifyToken, orderController.cancelOrder)
router.put('/:id/status', verifyToken, orderController.adminUpdateOrderStatus);

//Payment status update (Admin/System)
router.patch('/:id/payment-status', verifyToken, orderController.updatePaymentStatus);

//Admin 
router.post('/:id/verify-cod', verifyToken, orderController.verifyCOD);

module.exports = router;