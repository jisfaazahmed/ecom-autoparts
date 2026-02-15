const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const OrderTimeline = require('../models/timeline.model');

class PaymentService {

    //create payment
    async initiatePayment(orderId, userId, paymentData) {
        try {
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
                amount: order.totalAmount,
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
            order.transactionId = payment.provider.transactionId;
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
        catch (error) {
            { throw error; }
        }
    }

    //process card payment
    async processCardPayment(payment, cardDetails, order) {
        try {
            const amountInCents = Math.round(payment.amount * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amountInCents,
                currency: payment.currency.toLowerCase(),
                payment_method_types: ['card'],
                metadata: {
                    orderId: order._id.toString(),
                    orderNumber: order.orderNumber,
                    userId: payment.user.toString()
                },
                description: `Payment for Order ${order.orderNumber}`,
                receipt_email: cardDetails.email
            });

            payment.provider = {
                name: 'stripe',
                paymentIntentId: paymentIntent.id,
                transactionId: paymentIntent.id
            };

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
        catch (error) {
            { throw error }
        }
    }

    //confirm card payment
    async confirmCardPayment(PayamentIntentId, paymentId) {

        try {
            const payment = await Payment.findById(paymentId);

            if (!payment) {
                throw new Error('Payment not found');
            }

            const paymentIntent = await stripe.paymentIntents.retrieve(PayamentIntentId);

            if (paymentIntent.status === 'succeeded') {
                payment.status = 'completed';
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
        catch (error) {
            { throw error }
        }
    }

    //process COD payment
    async processCODPayment(order, payment) {

        try {
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
        catch (error) {
            { throw error }
        }
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

        try {
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

        catch (error) {
            throw Error
        }
    }

    // Confirm COD Collection
    async confirmCODCollection(paymentId, collectionData) {

        try {
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

            const order = await Order.findById(payment.order);
            order.paymentStatus = 'completed';
            await order.save();

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

        catch (error) {
            throw Error
        }
    }

    //process refund
    async processStripeRefund(payment, amount) {
        try {
            const refund = await stripe.refunds.create({
                payment_intent: payment.provider.paymentIntentId,
                amount: Math.round(amount * 100),
                reason: 'requested_by_customer'
            });

            payment.refund.refundId = refund.id;
            payment.refund.status = 'completed';
            payment.refund.processedAt = new Date();

        } catch (error) {
            payment.refund.status = 'failed';
            payment.gatewayResponse = {
                errorCode: error.code,
                errorMessage: error.message
            };
            throw error;
        }
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