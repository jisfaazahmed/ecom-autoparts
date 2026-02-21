const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const paymentService = require('../services/payment.service');
const stripe = require('../config/stripe');

// Create Stripe checkout session
exports.createCheckoutSession = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        const order = await Order.findById(orderId).populate('items');

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        if (order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access to order'
            });
        }

        // Create line items for Stripe
        const lineItems = [{
            price_data: {
                currency: order.currency || 'lkr',
                product_data: {
                    name: `Order #${order.orderNumber}`,
                    description: `Order contains ${order.items.length} item(s)`,
                },
                unit_amount: Math.round(order.totalAmount * 100), // Convert to cents
            },
            quantity: 1,
        }];

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment-success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
            cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment-cancel?order_id=${orderId}`,
            customer_email: req.user.email,
            metadata: {
                orderId: orderId.toString(),
                orderNumber: order.orderNumber,
                userId: req.user._id.toString()
            },
            client_reference_id: orderId.toString(),
        });

        // Update order with session info
        order.paymentStatus = 'processing';
        order.stripeSessionId = session.id;
        await order.save();

        res.status(200).json({
            success: true,
            data: {
                sessionId: session.id,
                url: session.url
            }
        });
    } catch (error) {
        console.error('Checkout session error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create checkout session'
        });
    }
};

// Stripe webhook handler
exports.handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event.data.object);
                break;
            
            case 'payment_intent.succeeded':
                await handlePaymentIntentSucceeded(event.data.object);
                break;
            
            case 'payment_intent.payment_failed':
                await handlePaymentIntentFailed(event.data.object);
                break;

            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
};

// Helper function to handle successful checkout
async function handleCheckoutSessionCompleted(session) {
    const orderId = session.metadata.orderId || session.client_reference_id;
    
    if (!orderId) {
        console.error('No order ID in session metadata');
        return;
    }

    const order = await Order.findById(orderId);
    
    if (!order) {
        console.error(`Order not found: ${orderId}`);
        return;
    }

    // Create or update payment record
    let payment = await Payment.findOne({ order: orderId });
    
    if (!payment) {
        payment = new Payment({
            order: orderId,
            user: order.user,
            paymentMethod: 'card',
            amount: order.totalAmount,
            totalAmount: order.totalAmount,
            currency: order.currency || 'LKR',
            status: 'completed',
            transactionId: session.payment_intent,
            gatewayTransactionId: session.payment_intent,
            gateway: 'stripe',
            metadata: {
                sessionId: session.id,
                customerEmail: session.customer_email,
            }
        });
    } else {
        payment.status = 'completed';
        payment.transactionId = session.payment_intent;
        payment.gatewayTransactionId = session.payment_intent;
        payment.gateway = 'stripe';
    }

    payment.timeline.push({
        event: 'payment_completed',
        timestamp: new Date(),
        description: 'Payment completed successfully via Stripe'
    });

    await payment.save();

    // Update order status to paid
    order.paymentStatus = 'completed';
    order.transactionId = session.payment_intent;
    order.paidAmount = order.totalAmount;
    order.paymentId = payment._id;
    order.overallStatus = 'confirmed';
    
    await order.save();

    // Create timeline event
    const OrderTimeline = require('../models/timeline.model');
    await OrderTimeline.create({
        order: orderId,
        event: 'payment_completed',
        title: 'Payment Completed',
        description: `Payment of ${order.currency} ${order.totalAmount} completed successfully via Stripe`,
        actorType: 'system',
    });

    console.log(`Payment completed for order ${order.orderNumber}`);
}

// Helper function to handle successful payment intent
async function handlePaymentIntentSucceeded(paymentIntent) {
    const payment = await Payment.findOne({ 
        'provider.paymentIntentId': paymentIntent.id 
    });

    if (payment) {
        payment.status = 'completed';
        payment.provider = payment.provider || {};
        payment.provider.chargeId = paymentIntent.charges.data[0]?.id;
        payment.provider.receiptUrl = paymentIntent.charges.data[0]?.receipt_url;
        
        payment.timeline.push({
            event: 'payment_completed',
            timestamp: new Date(),
            description: 'Payment intent succeeded'
        });

        await payment.save();

        // Update order
        const order = await Order.findById(payment.order);
        if (order) {
            order.paymentStatus = 'completed';
            order.transactionId = paymentIntent.id;
            order.paidAmount = payment.amount;
            await order.save();
        }
    }
}

// Helper function to handle failed payment
async function handlePaymentIntentFailed(paymentIntent) {
    const payment = await Payment.findOne({ 
        'provider.paymentIntentId': paymentIntent.id 
    });

    if (payment) {
        payment.status = 'failed';
        payment.timeline.push({
            event: 'payment_failed',
            timestamp: new Date(),
            description: paymentIntent.last_payment_error?.message || 'Payment failed'
        });

        await payment.save();

        // Update order
        const order = await Order.findById(payment.order);
        if (order) {
            order.paymentStatus = 'failed';
            await order.save();
        }
    }
}

//create payment
exports.createPayment = async (req, res) => {
    try {
        const payment = await paymentService.initiatePayment(
            req.params.orderId,
            req.user._id,
            {
                ...req.body,
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            }
        );

        res.status(200).json(
            {
                data: payment,
                message: 'Payment initiated'
            }
        )
    }
    catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
}

// Card payment confirmation
exports.confirmCardPayment = async (req, res) => {
    try {
        const { paymentIntentId } = req.body;

        const payment = await paymentService.confirmCardPayment(
            req.params.paymentId,
            paymentIntentId
        );

        res.status(200).json({
            data: payment
        });
    } catch (error) {
        res.status(400).json(
            {
                success: false,
                message: error.message
            }
        );
    }
}

// Verify COD
exports.verifyCOD = async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    const payment = await paymentService.verifyCOD(
      req.params.paymentId,
      req.user._id,
      status,
      notes
    );
    
    res.json({
      success: true,
      message: 'COD verification updated',
      data: payment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

//confirm cod
exports.confirmCODCollection = async (req, res) => {
  try {
    const payment = await paymentService.confirmCODCollection(
      req.params.paymentId,
      req.body
    );
    
    res.json({
      success: true,
      message: 'COD collection confirmed',
      data: payment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.processRefund = async (req, res) => {
  try {
    const payment = await paymentService.processRefund(
      req.params.paymentId,
      {
        ...req.body,
        initiatedBy: req.user._id
      }
    );
    
    res.json({
      success: true,
      message: 'Refund initiated successfully',
      data: payment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.getPaymentDetails = async (req, res) => {
  try {
    const payment = await paymentService.getPaymentDetails(
      req.params.paymentId,
      req.user._id
    );
    
    res.json({
      success: true,
      data: payment
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Get User Payments
exports.getUserPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { user: req.user._id };
    if (status) query.status = status;
    
    const payments = await Payment.find(query)
      .populate('order', 'orderNumber totalAmount')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Payment.countDocuments(query);
    
    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

module.exports = exports;