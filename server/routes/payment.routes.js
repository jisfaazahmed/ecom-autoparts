const router = require('express').Router();
const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { verifyToken } = require('../middleware/authMiddleware');

// Stripe webhook (must be before any body parsing middleware)
router.post('/webhook', 
    express.raw({ type: 'application/json' }), 
    paymentController.handleStripeWebhook
);

// Customer routes (require authentication)
router.post('/create-checkout-session', verifyToken, paymentController.createCheckoutSession);
router.post('/create-payment-intent', verifyToken, paymentController.createPaymentIntent);
router.post('/confirm-payment-intent', verifyToken, paymentController.confirmPaymentIntent);
router.post('/retry-payment-intent', verifyToken, paymentController.retryPaymentIntent);
router.get('/wallet/balance', verifyToken, paymentController.getWalletBalance);
router.post('/wallet/pay', verifyToken, paymentController.payWithWallet);
router.post('/initiate/:orderId', verifyToken, paymentController.createPayment);
router.post('/confirm-card/:paymentId', verifyToken, paymentController.confirmCardPayment);
router.get('/my-payments', verifyToken, paymentController.getUserPayments);
router.get('/:paymentId', verifyToken, paymentController.getPaymentDetails);

// Admin routes
router.post('/verify-cod/:paymentId', verifyToken, paymentController.verifyCOD);
router.post('/refund/:paymentId', verifyToken, paymentController.processRefund);

// Courier/Delivery agent routes
router.post('/confirm-cod/:paymentId', verifyToken, paymentController.confirmCODCollection);

module.exports = router;