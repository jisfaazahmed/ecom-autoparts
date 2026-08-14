const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const OrderItem = require('../models/orderItem.model');
const User = require('../models/user');
const WalletTransaction = require('../models/walletTransaction.model');
const stripe = require('../config/stripe');
const OrderTimeline = require('../models/timeline.model');
const invoiceService = require('./invoice.service');

class PaymentService {
    // COD orders above this value are held until a human verifies the buyer by phone.
    static COD_VERIFICATION_THRESHOLD = 10000;
    static MAX_COD_VERIFICATION_ATTEMPTS = 3;

    async syncOrderAfterPayment(orderId, { paymentStatus = 'completed', transactionId = null } = {}) {
        const order = await Order.findById(orderId);

        if (!order) {
            throw new Error('Order not found');
        }

        order.paymentStatus = paymentStatus;
        if (transactionId) {
            order.transactionId = transactionId;
        }
        order.paidAmount = order.totalAmount;
        // Keep the order awaiting vendor approval. Vendor-only status transitions
        // should move items/sub-orders from pending -> confirmed -> processing.
        order.overallStatus = await this.calculateOrderStatusFromItems(order.items);

        await order.save();
        return order;
    }

    async calculateOrderStatusFromItems(orderItemsOrIds) {
        const itemIds = Array.isArray(orderItemsOrIds)
            ? orderItemsOrIds.map((item) => String(item._id || item))
            : [];

        if (itemIds.length === 0) {
            return 'pending';
        }

        const orderItems = await OrderItem.find({ _id: { $in: itemIds } });
        const statuses = orderItems.map((item) => String(item.status || '').toLowerCase());

        if (statuses.every((s) => s === 'delivered')) return 'delivered';
        if (statuses.every((s) => s === 'cancelled')) return 'cancelled';
        if (statuses.every((s) => s === 'refunded')) return 'refunded';
        if (statuses.some((s) => s === 'processing' || s === 'ready_to_ship' || s === 'shipped')) return 'processing';
        if (statuses.some((s) => s === 'confirmed')) return 'confirmed';

        return 'pending';
    }

    //create payment
    async initiatePayment(orderId, userId, paymentData) {
        const order = await Order.findById(orderId);

        if (!order) {
            throw new Error("order not found");
        }
        if (!order.user || !userId || order.user.toString() !== userId.toString()) {
            throw new Error('Unauthorized access to order');
        }

        const { paymentMethod, ...methodDetails } = paymentData;

        const existing = await Payment.findOne({ order: orderId });
        if (existing && existing.status === 'completed') {
            throw new Error('Order is already paid');
        }

        const payment = existing || new Payment({
            order: orderId,
            user: userId,
            paymentMethod,
            gateway: paymentMethod === 'card' ? 'stripe' : paymentMethod,
            amount: order.totalAmount,
            totalAmount: order.totalAmount,
            currency: order.currency || 'LKR',
            status: 'pending'
        });

        payment.paymentMethod = paymentMethod;
        payment.amount = order.totalAmount;
        payment.totalAmount = order.totalAmount;
        payment.timeline.push({
            event: 'payment_initiated',
            timestamp: new Date(),
            description: `Payment initiated via ${paymentMethod}`
        });

        switch (paymentMethod) {
            case 'card':
                await this.processCardPayment(payment, methodDetails, order);
                break;

            case 'cod':
                await this.processCODPayment(payment, order);
                break;

            default:
                throw new Error('Invalid payment method');
        }

        await payment.save();

        // Update order payment info
        order.paymentId = payment._id;
        order.paymentStatus = payment.status;
        order.transactionId = payment.transactionId || null;
        await order.save();

        //Timeline
        await OrderTimeline.create({
            order: orderId,
            event: 'payment_pending',
            title: 'Payment Initiated',
            description: `Payment of LKR ${payment.amount} initiated via ${paymentMethod}`,
            actor: userId,
            actorType: 'customer',
        });

        return payment;
    }

    //process card payment
    async processCardPayment(payment, cardDetails, order) {
        const amountInCents = Math.round(payment.amount * 100);

        const receiptEmail = String(cardDetails.email || '').trim();
        const stripePayload = {
            amount: amountInCents,
            currency: payment.currency.toLowerCase(),
            payment_method_types: ['card'],
            metadata: {
                orderId: order._id.toString(),
                orderNumber: order.orderNumber,
                userId: payment.user.toString()
            },
            description: `Payment for Order ${order.orderNumber}`,
        };

        if (receiptEmail) {
            stripePayload.receipt_email = receiptEmail;
        }

        const paymentIntent = await stripe.paymentIntents.create(stripePayload);

        payment.gateway = 'stripe';
        payment.transactionId = paymentIntent.id;
        payment.gatewayTransactionId = paymentIntent.id;

        payment.status = 'processing';
        payment.timeline.push({
            event: 'payment_processing',
            timestamp: new Date(),
            description: 'Stripe payment intent created'
        });

        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        };
    }

    //confirm card payment
    async confirmCardPayment(paymentIntentId, paymentId) {
        const payment = await Payment.findById(paymentId);

        if (!payment) {
            throw new Error('Payment not found');
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === 'succeeded') {
            payment.status = 'completed';
            payment.gateway = 'stripe';
            payment.transactionId = paymentIntent.id;
            payment.gatewayTransactionId = paymentIntent.id;

            payment.timeline.push({
                event: 'payment_completed',
                timestamp: new Date(),
                description: 'Payment successful'
            });

            await payment.save();

            await this.syncOrderAfterPayment(payment.order, {
                paymentStatus: 'completed',
                transactionId: paymentIntent.id
            });

            await OrderTimeline.create({
                order: payment.order,
                event: 'payment_completed',
                title: 'Payment Completed',
                description: `Payment of ${payment.currency} ${payment.amount} completed successfully`,
                actorType: 'system',
            });

            await this.generateReceipt(payment._id);
            return Payment.findById(payment._id);
        }

        if (paymentIntent.status === 'requires_payment_method' || paymentIntent.status === 'canceled') {
            payment.status = 'failed';
            payment.gatewayResponse = {
                errorCode: paymentIntent.last_payment_error?.code,
                errorMessage: paymentIntent.last_payment_error?.message
            };
            payment.timeline.push({
                event: 'payment_failed',
                timestamp: new Date(),
                description: paymentIntent.last_payment_error?.message || 'Payment failed'
            });

            const order = await Order.findById(payment.order);
            if (order) {
                order.paymentStatus = 'failed';
                await order.save();
            }
        }

        await payment.save();
        return payment;
    }

    // Creates the COD payment record at order placement so that the
    // verify-cod / confirm-cod flows have a document to act on.
    async createCODPayment(order, userId = null) {
        const existing = await Payment.findOne({ order: order._id });
        if (existing) {
            return existing;
        }

        const payment = new Payment({
            order: order._id,
            user: userId || order.user || null,
            paymentMethod: 'cod',
            gateway: 'cod',
            amount: order.totalAmount,
            totalAmount: order.totalAmount,
            currency: order.currency || 'LKR',
            status: 'pending'
        });

        await this.processCODPayment(payment, order);
        await payment.save();

        order.paymentId = payment._id;
        order.paymentStatus = 'pending';
        await order.save();

        await OrderTimeline.create({
            order: order._id,
            event: 'payment_pending',
            title: 'Payment Pending',
            description: `Cash on Delivery payment of ${payment.currency} ${payment.amount} is pending collection`,
            actor: userId || null,
            actorType: userId ? 'customer' : 'guest'
        });

        return payment;
    }

    //process COD payment
    async processCODPayment(payment, order) {
        payment.status = 'pending';
        payment.gateway = 'cod';
        payment.codDetails = payment.codDetails || {};
        payment.codDetails.collectionStatus = 'pending';
        payment.codDetails.verificationAttempts = payment.codDetails.verificationAttempts || [];

        // High-value COD orders are held until a human verifies the buyer by phone.
        if (payment.amount > PaymentService.COD_VERIFICATION_THRESHOLD) {
            payment.codDetails.verificationStatus = 'pending';
            this.appendCODVerificationAttempt(payment, order);
        } else {
            payment.codDetails.verificationStatus = 'not_required';
            payment.status = 'processing';

            // Caller persists the order; mutate in place to avoid a stale second write.
            if (order) {
                order.codVerified = true;
            }
        }

        payment.timeline.push({
            event: payment.status === 'processing' ? 'payment_processing' : 'payment_initiated',
            timestamp: new Date(),
            description: 'COD payment initiated'
        });
    }

    //COD verification - records a pending attempt on the in-memory document
    appendCODVerificationAttempt(payment, order) {
        payment.codDetails.verificationAttempts.push({
            attemptedAt: new Date(),
            method: 'sms',
            contactNumber: order?.shippingAddress?.phone,
            status: 'pending',
            notes: 'Verification SMS sent'
        });

        return payment;
    }

    async initiateCODVerification(paymentId) {
        const payment = await Payment.findById(paymentId);

        if (!payment) {
            throw new Error('Payment not found');
        }

        const order = await Order.findById(payment.order);

        payment.codDetails = payment.codDetails || {};
        payment.codDetails.verificationStatus = 'pending';
        payment.codDetails.verificationAttempts = payment.codDetails.verificationAttempts || [];
        this.appendCODVerificationAttempt(payment, order);

        await payment.save();
        return payment;
    }

    // Verify COD
    async verifyCOD(paymentId, verifiedBy, status, notes) {
        const payment = await Payment.findById(paymentId);

        if (!payment) {
            throw new Error('Payment not found');
        }

        if (payment.paymentMethod !== 'cod') {
            throw new Error('Payment is not a Cash on Delivery payment');
        }

        payment.codDetails = payment.codDetails || {};
        payment.codDetails.verificationAttempts = payment.codDetails.verificationAttempts || [];

        const attempts = payment.codDetails.verificationAttempts;
        const lastAttempt = attempts[attempts.length - 1];

        // The courier/admin may verify without a pre-recorded attempt (e.g. inbound call).
        if (lastAttempt && lastAttempt.status === 'pending') {
            lastAttempt.attemptedBy = verifiedBy;
            lastAttempt.status = status;
            lastAttempt.notes = notes;
        } else {
            attempts.push({
                attemptedAt: new Date(),
                attemptedBy: verifiedBy,
                method: 'call',
                status,
                notes
            });
        }

        if (status === 'success') {
            payment.codDetails.verificationStatus = 'verified';
            payment.status = 'processing';

            const order = await Order.findById(payment.order);
            if (order) {
                order.codVerified = true;
                order.overallStatus = 'confirmed';
                await order.save();
            }

            await OrderTimeline.create({
                order: payment.order,
                event: 'cod_verified',
                title: 'COD Verified',
                description: 'Cash on Delivery order has been verified',
                actor: verifiedBy,
                actorType: 'admin'
            });

        } else if (attempts.length >= PaymentService.MAX_COD_VERIFICATION_ATTEMPTS) {
            payment.codDetails.verificationStatus = 'failed';
            payment.status = 'failed';
            payment.timeline.push({
                event: 'payment_failed',
                timestamp: new Date(),
                description: 'COD verification failed after multiple attempts'
            });

            const order = await Order.findById(payment.order);
            if (order) {
                order.overallStatus = 'cancelled';
                order.paymentStatus = 'failed';
                order.cancellationRequest = {
                    requestedBy: verifiedBy,
                    requestedAt: new Date(),
                    reason: 'COD verification failed after multiple attempts',
                    status: 'approved'
                };
                await order.save();
            }
        }

        await payment.save();
        return payment;
    }

    // Confirm COD Collection
    async confirmCODCollection(paymentId, collectionData) {
        const payment = await Payment.findById(paymentId);

        if (!payment || payment.paymentMethod !== 'cod') {
            throw new Error('Invalid payment');
        }

        if (payment.status === 'completed') {
            return payment;
        }

        payment.codDetails = payment.codDetails || {};
        payment.codDetails.collectedAmount = collectionData.amount;
        payment.codDetails.collectedBy = collectionData.collectedBy;
        payment.codDetails.collectedDate = new Date();
        payment.codDetails.changeAmount = collectionData.changeAmount || 0;
        payment.codDetails.collectionStatus = 'collected';
        payment.codDetails.collectionProof = {
            image: collectionData.proofImage || null,
            signature: collectionData.signature || null,
            notes: collectionData.notes || null
        };

        payment.status = 'completed';
        payment.transactionId = payment.transactionId || `COD-${Date.now()}`;
        payment.timeline.push({
            event: 'payment_completed',
            timestamp: new Date(),
            description: `COD amount collected by ${collectionData.collectedBy}`
        });

        await payment.save();

        await this.syncOrderAfterPayment(payment.order, {
            paymentStatus: 'completed',
            transactionId: payment.transactionId
        });

        await OrderTimeline.create({
            order: payment.order,
            event: 'payment_completed',
            title: 'Payment Collected',
            description: `COD payment of ${payment.currency} ${collectionData.amount} collected`,
            actorType: 'courier',
            metadata: { collectedBy: collectionData.collectedBy }
        });

        return payment;
    }

    //process refund
    async processStripeRefund(payment, amount) {
        try {
            const paymentIntentId = payment.gatewayTransactionId || payment.transactionId;
            if (!paymentIntentId) {
                throw new Error('Stripe payment intent not found for refund');
            }

            const refund = await stripe.refunds.create({
                payment_intent: paymentIntentId,
                amount: Math.round(amount * 100),
                reason: 'requested_by_customer'
            });

            payment.refunds = payment.refunds || [];
            payment.refunds.push({
                refundId: refund.id,
                amount,
                reason: 'requested_by_customer',
                status: 'completed',
                processedAt: new Date(),
                gatewayRefundId: refund.id,
                refundMethod: 'original_method',
                notes: 'Stripe refund completed'
            });

            await this.applyRefundStatus(payment, amount);
            await payment.save();
            return refund;

        } catch (error) {
            payment.refunds = payment.refunds || [];
            payment.refunds.push({
                refundId: `FAILED-${Date.now()}`,
                amount,
                reason: 'requested_by_customer',
                status: 'failed',
                notes: error.message
            });
            payment.gatewayResponse = {
                errorCode: error.code,
                errorMessage: error.message
            };
            payment.timeline.push({
                event: 'refund_failed',
                timestamp: new Date(),
                description: error.message
            });
            await payment.save();
            throw error;
        }
    }

    async processRefund(paymentId, refundData) {
        const payment = await Payment.findById(paymentId);

        if (!payment) {
            throw new Error('Payment not found');
        }

        if (payment.status !== 'completed') {
            throw new Error(`Only completed payments can be refunded. Current status: ${payment.status}`);
        }

        const alreadyRefunded = (payment.refunds || [])
            .filter((refund) => ['completed', 'pending', 'processing'].includes(refund.status))
            .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
        const refundable = Number(payment.amount || 0) - alreadyRefunded;
        const amount = Number(refundData.amount || refundable);

        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error('Refund amount must be a positive number');
        }

        if (amount > refundable) {
            throw new Error(`Refund amount exceeds the refundable balance of ${refundable}`);
        }

        const method = String(payment.paymentMethod || '').toLowerCase();
        const requestedMethod = String(refundData.refundMethod || '').toLowerCase();

        payment.timeline.push({
            event: 'refund_initiated',
            timestamp: new Date(),
            description: `Refund of ${payment.currency} ${amount} initiated`
        });

        // An explicit wallet/store-credit request wins over the original method,
        // so a card order can be refunded as store credit when the customer asks.
        if (['wallet', 'store_credit'].includes(requestedMethod) && payment.user) {
            await this.processWalletRefund(payment, amount, refundData);
        } else if (method === 'card' && (payment.gatewayTransactionId || payment.transactionId)) {
            await this.processStripeRefund(payment, amount);
        } else if (method === 'wallet') {
            await this.processWalletRefund(payment, amount, refundData);
        } else {
            // COD has no gateway to reverse - finance settles this offline.
            payment.refunds = payment.refunds || [];
            payment.refunds.push({
                refundId: `MANUAL-${Date.now()}`,
                amount,
                reason: refundData.reason,
                status: 'pending',
                initiatedBy: refundData.initiatedBy,
                initiatedAt: new Date(),
                refundMethod: refundData.refundMethod || 'manual',
                notes: 'COD/manual refund requires offline processing'
            });

            await this.applyRefundStatus(payment, amount);
        }

        await payment.save();
        return payment;
    }

    // Wallet refunds credit the customer balance immediately.
    async processWalletRefund(payment, amount, refundData = {}) {
        const user = await User.findById(payment.user);

        if (!user) {
            throw new Error('User not found for wallet refund');
        }

        const credited = await User.findByIdAndUpdate(
            payment.user,
            { $inc: { 'wallet.balance': amount } },
            { new: true }
        ).select('wallet');

        const refundId = `WALLET-REFUND-${payment._id}-${Date.now()}`;

        await WalletTransaction.create({
            user: payment.user,
            type: 'credit',
            amount,
            balanceAfter: Number(credited?.wallet?.balance || 0),
            currency: payment.currency || 'LKR',
            source: 'refund',
            reference: refundId,
            order: payment.order,
            payment: payment._id,
            description: `Refund for payment ${payment.paymentNumber}`,
        });

        payment.refunds = payment.refunds || [];
        payment.refunds.push({
            refundId,
            amount,
            reason: refundData.reason,
            status: 'completed',
            initiatedBy: refundData.initiatedBy,
            initiatedAt: new Date(),
            processedAt: new Date(),
            actualCompletionDate: new Date(),
            refundMethod: 'wallet',
            notes: 'Refunded to wallet balance'
        });

        await this.applyRefundStatus(payment, amount);
        return payment;
    }

    // Mark the payment/order as fully or partially refunded based on the running total.
    async applyRefundStatus(payment, amount) {
        const refundedTotal = (payment.refunds || [])
            .filter((refund) => ['completed', 'pending', 'processing'].includes(refund.status))
            .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
        const isFullRefund = refundedTotal >= Number(payment.amount || 0);

        payment.status = isFullRefund ? 'refunded' : 'completed';
        payment.timeline.push({
            event: 'refund_completed',
            timestamp: new Date(),
            description: `Refund of ${payment.currency} ${amount} recorded`
        });

        const order = await Order.findById(payment.order);
        if (order) {
            order.paymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';
            if (isFullRefund) {
                order.overallStatus = 'refunded';
            }
            await order.save();
        }

        return payment;
    }

    // Generate Receipt
    async generateReceipt(paymentId) {
        const payment = await Payment.findById(paymentId).populate('order');

        if (!payment) {
            throw new Error('Payment not found');
        }

        const orderId = payment.order?._id || payment.order;

        try {
            await invoiceService.generateInvoicePdf(orderId);
        } catch (error) {
            console.error(`Receipt generation failed for payment ${payment.paymentNumber}:`, error.message);
        }

        payment.receipt = {
            url: `/api/orders/${orderId}/invoice`,
            generatedAt: new Date()
        };

        await payment.save();
        return payment.receipt;
    }

    async getPaymentDetails(paymentId, userId) {
        const payment = await Payment.findById(paymentId)
            .populate('order')
            .populate('user', 'name email phone');

        if (!payment) {
            throw new Error('Payment not found');
        }

        const isOwner = payment.user?._id?.toString() === userId?.toString();

        if (!isOwner) {
            const requester = await User.findById(userId).select('role');
            const role = String(requester?.role || '').replace(/_/g, '').toUpperCase();

            if (!['ADMIN', 'SUPERADMIN'].includes(role)) {
                throw new Error('Unauthorized access');
            }
        }

        return payment;
    }
}

module.exports = new PaymentService();