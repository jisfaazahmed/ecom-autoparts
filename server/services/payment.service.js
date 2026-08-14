const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const OrderItem = require('../models/orderItem.model');
const stripe = require('../config/stripe');
const OrderTimeline = require('../models/timeline.model');

class PaymentService {

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
        if (order.user.toString() != userId.toString()) {
            throw new Error("unautharized");
        }

        const { paymentMethod, ...methodDetails } = paymentData;

        const payment = new Payment({
            order: orderId,
            user: userId,
            paymentMethod,
            gateway: paymentMethod === 'card' ? 'stripe' : paymentMethod,
            amount: order.totalAmount,
            totalAmount: order.totalAmount,
            currency: 'LKR',
            status: 'pending',
            metadata: {
                ipAddress: paymentData.ipAddress,
                userAgent: paymentData.userAgent
            }
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
        order.transactionId = payment.provider?.transactionId || payment.transactionId || null;
        await order.save();

        //Timeline
        await OrderTimeline.create({
            order: orderId,
            event: 'payment_initiated',
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

        payment.provider = {
            name: 'stripe',
            paymentIntentId: paymentIntent.id,
            transactionId: paymentIntent.id
        };
        payment.gateway = 'stripe';

        payment.status = 'processing';
        payment.statusHistory.push({
            status: 'processing',
            timestamp: new Date(),
            note: 'Stripe payment intent created'
        });

        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        };
    }

    //confirm card payment
    async confirmCardPayment(PaymentIntentId, paymentId) {
        const payment = await Payment.findById(paymentId);

        if (!payment) {
            throw new Error('Payment not found');
        }

        const paymentIntent = await stripe.paymentIntents.retrieve(PaymentIntentId);

        if (paymentIntent.status === 'succeeded') {
            payment.status = 'completed';
            payment.gateway = 'stripe';
            payment.provider.chargeId = paymentIntent.charges.data[0]?.id;
            payment.provider.receiptUrl = paymentIntent.charges.data[0]?.receipt_url;

            payment.statusHistory.push({
                status: 'completed',
                timestamp: new Date(),
                note: 'Payment successful'
            });

            const order = await Order.findById(payment.order);
            order.paymentStatus = 'completed';
            await order.save();

            await OrderTimeline.create({
                order: payment.order,
                event: 'payment_completed',
                title: 'Payment Completed',
                description: `Payment of LKR ${payment.amount} completed successfully`,
                actorType: 'system',
            });

            await this.generateReceipt(payment._id);
        }
        else if (paymentIntent.status === 'payment_failed') {
            payment.status = 'failed';
            payment.gatewayResponse = {
                errorCode: paymentIntent.last_payment_error?.code,
                errorMessage: paymentIntent.last_payment_error?.message
            };
        }

        await payment.save();
        return payment;
    }

    //process COD payment
    async processCODPayment(payment, order) {
        payment.status = 'pending';
        payment.cod = {
            verified: false,
            verificationAttempts: []
        };

        if (payment.amount > 10000) {
            await this.initiateCODVerification(payment._id, order);
        }
        else {
            payment.cod.verified = true;
            payment.status = 'processing';

            const orderDoc = await Order.findById(order._id);
            orderDoc.paymentStatus = 'pending';
            orderDoc.codVerified = true;
            await orderDoc.save();
        }

        payment.statusHistory.push({
            status: payment.status,
            timestamp: new Date(),
            note: 'COD payment initiated'
        });
    }

    //COD verification
    async initiateCODVerification(paymentId, order) {
        const payment = await Payment.findById(paymentId).populate('user');

        payment.cod.verificationAttempts.push({
            attemptedAt: new Date(),
            contactNumber: order.shippingAddress.phone,
            status: 'pending',
            notes: 'Verification SMS sent'
        });

        await payment.save();
    }

    // Verify COD
    async verifyCOD(paymentId, verifiedBy, status, notes) {
        const payment = await Payment.findById(paymentId);

        if (!payment) {
            throw new Error('Payment not found');
        }

        const lastAttempt = payment.cod.verificationAttempts[payment.cod.verificationAttempts.length - 1];
        lastAttempt.attemptedBy = verifiedBy;
        lastAttempt.status = status;
        lastAttempt.notes = notes;

        if (status === 'success') {
            payment.cod.verified = true;
            payment.status = 'processing';

            const order = await Order.findById(payment.order);
            order.codVerified = true;
            order.overallStatus = 'confirmed';
            await order.save();

            await OrderTimeline.create({
                order: payment.order,
                event: 'cod_verified',
                title: 'COD Verified',
                description: 'Cash on Delivery order has been verified',
                actor: verifiedBy,
                actorType: 'admin'
            });

        } else if (payment.cod.verificationAttempts.length >= 3) {
            payment.status = 'failed';

            const order = await Order.findById(payment.order);
            order.overallStatus = 'cancelled';
            order.cancellationRequest = {
                reason: 'COD verification failed after multiple attempts',
                status: 'approved'
            };
            await order.save();
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

        payment.cod.collectedAmount = collectionData.amount;
        payment.cod.collectedBy = collectionData.collectedBy;
        payment.cod.collectedAt = new Date();
        payment.cod.changeAmount = collectionData.changeAmount || 0;
        payment.cod.collectionProof = collectionData.proofImage;

        payment.status = 'completed';
        payment.statusHistory.push({
            status: 'completed',
            timestamp: new Date(),
            note: `COD amount collected by ${collectionData.collectedBy}`
        });

        await this.syncOrderAfterPayment(payment.order, {
            paymentStatus: 'completed',
            transactionId: `COD-${Date.now()}`,
            itemStatus: 'pending'
        });

        await payment.save();

        await OrderTimeline.create({
            order: payment.order,
            event: 'payment_completed',
            title: 'Payment Collected',
            description: `COD payment of LKR ${collectionData.amount} collected`,
            actorType: 'courier',
            metadata: { collectedBy: collectionData.collectedBy }
        });

        return payment;
    }

    //process refund
    async processStripeRefund(payment, amount) {
        try {
            const paymentIntentId = payment.provider?.paymentIntentId || payment.gatewayTransactionId || payment.transactionId;
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
            payment.status = 'refunded';

            const order = await Order.findById(payment.order);
            if (order) {
                order.paymentStatus = 'refunded';
                order.overallStatus = 'refunded';
                await order.save();
            }

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
            throw error;
        }
    }

    async processRefund(paymentId, refundData) {
        const payment = await Payment.findById(paymentId);

        if (!payment) {
            throw new Error('Payment not found');
        }

        const amount = refundData.amount || payment.amount;

        if ((payment.paymentMethod || '').toLowerCase() === 'card' && (payment.provider?.paymentIntentId || payment.gatewayTransactionId || payment.transactionId)) {
            await this.processStripeRefund(payment, amount);
        } else {
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
            payment.status = 'refunded';
            const order = await Order.findById(payment.order);
            if (order) {
                order.paymentStatus = 'refunded';
                order.overallStatus = 'refunded';
                await order.save();
            }
        }

        await payment.save();
        return payment;
    }

    // Generate Receipt
    async generateReceipt(paymentId) {
        const payment = await Payment.findById(paymentId)
            .populate('order')
            .populate('user', 'name email');

        payment.receipt = {
            url: ``,
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

        const user = await Order.findById(userId);
        if (payment.user._id.toString() !== userId.toString() && user.role !== 'admin') {
            throw new Error('Unauthorized access');
        }

        return payment;
    }
}

module.exports = new PaymentService();