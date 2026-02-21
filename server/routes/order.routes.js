const router = require('express').Router();
const orderController = require('../controllers/order.controller');

//customer
router.post('/', orderController.createOrder);
router.get('/my_orders', orderController.getAllOrders);
router.get('/:id',  orderController.getOrderById);
router.post('/:id/cancel', orderController.cancelOrder)

//track
router.get('/track/:id', orderController.trackOrder);

//vendor
router.get('/vendor/orders',   orderController.getVendorOrders);
router.patch('/:id/item-status',  orderController.updateOrderStatus);

//Payment status update (Admin/System)
router.patch('/:id/payment-status', orderController.updatePaymentStatus);

//Admin 
router.post('/:id/verify-cod', orderController.verifyCOD);

module.exports = router;