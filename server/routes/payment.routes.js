const router = require('express').Router();
const paymentController = require('../controllers/payment.controller');

// Customer routes
router.post('/initiate/:orderId', paymentController.initiatePayment);
router.post('/confirm-card/:paymentId', paymentController.confirmCardPayment);
router.get('/my-payments', paymentController.getUserPayments);
router.get('/:paymentId', paymentController.getPaymentDetails);

// Admin routes
router.post('/verify-cod/:paymentId',  paymentController.verifyCOD);
router.post('/refund/:paymentId',  paymentController.processRefund);

// Courier/Delivery agent routes
router.post('/confirm-cod/:paymentId',paymentController.confirmCODCollection);