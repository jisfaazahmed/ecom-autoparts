const router = require('express').Router();
const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { verifyToken } = require('../middleware/authMiddleware');
const {
    validateOrderIdBody,
    validateConfirmPaymentIntent,
    validateRetryPaymentIntent,
    validateConfirmCardPayment,
    validateVerifyCOD,
    validateConfirmCODCollection,
    validateWalletPay,
    validateProcessRefund,
    validateObjectIdParam,
    validatePaginationQuery,
} = require('../middleware/requestValidators');

// Stripe webhook (must be before any body parsing middleware)
router.post('/webhook', 
    express.raw({ type: 'application/json' }), 
    paymentController.handleStripeWebhook
);

// Customer routes (require authentication)
router.post('/create-checkout-session', verifyToken, validateOrderIdBody, paymentController.createCheckoutSession);
router.post('/create-payment-intent', verifyToken, validateOrderIdBody, paymentController.createPaymentIntent);
router.post('/confirm-payment-intent', verifyToken, validateConfirmPaymentIntent, paymentController.confirmPaymentIntent);
router.post('/retry-payment-intent', verifyToken, validateRetryPaymentIntent, paymentController.retryPaymentIntent);
router.get('/wallet/balance', verifyToken, paymentController.getWalletBalance);
router.post('/wallet/pay', verifyToken, validateWalletPay, paymentController.payWithWallet);
router.post('/initiate/:orderId', verifyToken, validateObjectIdParam('orderId', 'orderId'), paymentController.createPayment);
router.post('/confirm-card/:paymentId', verifyToken, validateConfirmCardPayment, paymentController.confirmCardPayment);
router.get('/my-payments', verifyToken, validatePaginationQuery, paymentController.getUserPayments);
router.get('/:paymentId', verifyToken, validateObjectIdParam('paymentId', 'paymentId'), paymentController.getPaymentDetails);

// Admin routes
router.post('/verify-cod/:paymentId', verifyToken, validateVerifyCOD, paymentController.verifyCOD);
router.post('/refund/:paymentId', verifyToken, validateProcessRefund, paymentController.processRefund);

// Courier/Delivery agent routes
router.post('/confirm-cod/:paymentId', verifyToken, validateConfirmCODCollection, paymentController.confirmCODCollection);

module.exports = router;