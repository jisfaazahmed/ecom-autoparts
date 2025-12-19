const router = require('express').Router();
const orderController = require('../controllers/order.controller');
const paymentController = require('../controllers/payment.controller');
const shippingController = require('../controllers/shipping.controller');

router.post('/create', orderController.createOrder);
router.get('/track/:id', orderController.trackOrder);
router.post('/payment/process', paymentController.processStripePayment);
router.post('/shipping/create', shippingController.createShipping);
router.post('/payment/confirm', paymentController.paymentConfirmation);
router.post('/payment/create', paymentController.createPayment);

module.exports = router;