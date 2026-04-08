const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const paymentService = require('../services/payment.service');
const stripe = require('../config/stripe');
const OrderTimeline = require('../models/timeline.model');

function isStripeMockMode() {
  return process.env.NODE_ENV === 'test' || process.env.USE_STRIPE_MOCK === 'true';
}

function getRequestUserId(req) {
  return req?.user?._id || req?.user?.id || null;
}

function getRequestUserEmail(req) {
  return req?.user?.email || null;
}

async function getAuthorizedOrder(orderId, userId) {
  const order = await Order.findById(orderId).populate('items');

  if (!order) {
    return { error: { status: 404, message: 'Order not found' } };
  }

  if (!userId) {
    return { error: { status: 401, message: 'Authentication is required' } };
  }

  if (!order.user || order.user.toString() !== userId.toString()) {
    return { error: { status: 403, message: 'Unauthorized access to order' } };
  }

  return { order };
}

async function finalizeSuccessfulCardPayment({ order, paymentIntentId, sessionId = null, customerEmail = null }) {
  let payment = await Payment.findOne({ order: order._id });

  if (!payment) {
    payment = new Payment({
      order: order._id,
      user: order.user,
      paymentMethod: 'card',
        gateway: 'stripe',
      amount: order.totalAmount,
      totalAmount: order.totalAmount,
      currency: order.currency || 'LKR',
      status: 'completed',
      transactionId: paymentIntentId,
      gatewayTransactionId: paymentIntentId,
      cardDetails: {},
    });
  } else {
    payment.status = 'completed';
    payment.gateway = 'stripe';
    payment.transactionId = paymentIntentId;
    payment.gatewayTransactionId = paymentIntentId;
  }

  payment.timeline.push({
    event: 'payment_completed',
    timestamp: new Date(),
    description: 'Payment completed successfully via Stripe',
  });

  await payment.save();

  await paymentService.syncOrderAfterPayment(order._id, {
    paymentStatus: 'completed',
    transactionId: paymentIntentId,
    itemStatus: 'confirmed',
  });

  order.paymentId = payment._id;
  order.stripeSessionId = sessionId || order.stripeSessionId;
  await order.save();

  await OrderTimeline.create({
    order: order._id,
    event: 'payment_completed',
    title: 'Payment Completed',
    description: `Payment of ${order.currency} ${order.totalAmount} completed successfully via Stripe`,
    actorType: 'system',
    metadata: {
      paymentIntentId,
      sessionId,
      customerEmail,
    },
  });

  return payment;
}

// Create Stripe checkout session
exports.createCheckoutSession = async (req, res) => {
    try {
        const { orderId } = req.body;
    const userId = getRequestUserId(req);
    const userEmail = getRequestUserEmail(req);

        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required'
            });
        }

        const orderResult = await getAuthorizedOrder(orderId, userId);
        if (orderResult.error) {
          return res.status(orderResult.error.status).json({ success: false, message: orderResult.error.message });
        }
        const { order } = orderResult;

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
          success_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
          cancel_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/cancel?order_id=${orderId}`,
            customer_email: userEmail,
            metadata: {
                orderId: orderId.toString(),
                orderNumber: order.orderNumber,
              userId: String(userId)
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

// Create Stripe PaymentIntent for inline card form
exports.createPaymentIntent = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = getRequestUserId(req);
    const userEmail = getRequestUserEmail(req);

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
    }

    const orderResult = await getAuthorizedOrder(orderId, userId);
    if (orderResult.error) {
      return res.status(orderResult.error.status).json({ success: false, message: orderResult.error.message });
    }
    const { order } = orderResult;

    if (String(order.paymentStatus || '').toLowerCase() === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Order is already paid',
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.totalAmount * 100),
      currency: String(order.currency || 'lkr').toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: String(userId),
      },
      receipt_email: userEmail,
      description: `Payment for order ${order.orderNumber}`,
    });

    order.paymentStatus = 'processing';
    await order.save();

    return res.status(200).json({
      success: true,
      data: {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: order.totalAmount,
        currency: order.currency || 'LKR',
        mockMode: isStripeMockMode(),
      },
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment intent',
    });
  }
};

// Confirm Stripe PaymentIntent and finalize order/payment records
exports.confirmPaymentIntent = async (req, res) => {
  try {
    const { orderId, paymentIntentId } = req.body;
    const userId = getRequestUserId(req);
    const userEmail = getRequestUserEmail(req);

    if (!orderId || !paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'orderId and paymentIntentId are required',
      });
    }

    const orderResult = await getAuthorizedOrder(orderId, userId);
    if (orderResult.error) {
      return res.status(orderResult.error.status).json({ success: false, message: orderResult.error.message });
    }
    const { order } = orderResult;

    const paymentIntent = isStripeMockMode()
      ? await stripe.paymentIntents.confirm(paymentIntentId)
      : await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: `Payment is not completed. Current status: ${paymentIntent.status}`,
      });
    }

    await finalizeSuccessfulCardPayment({
      order,
      paymentIntentId: paymentIntent.id,
      customerEmail: userEmail,
    });

    return res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        paymentIntentId: paymentIntent.id,
        paymentStatus: 'completed',
      },
    });
  } catch (error) {
    console.error('Confirm payment intent error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm payment intent',
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

    await finalizeSuccessfulCardPayment({
      order,
      paymentIntentId: session.payment_intent,
      sessionId: session.id,
      customerEmail: session.customer_email,
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
            await paymentService.syncOrderAfterPayment(order._id, {
              paymentStatus: 'completed',
              transactionId: paymentIntent.id,
              itemStatus: 'confirmed'
            });
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
    const userId = getRequestUserId(req);
        const payment = await paymentService.initiatePayment(
            req.params.orderId,
      userId,
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
    const userId = getRequestUserId(req);
    
    const payment = await paymentService.verifyCOD(
      req.params.paymentId,
      userId,
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
    const userId = getRequestUserId(req);
    const payment = await paymentService.processRefund(
      req.params.paymentId,
      {
        ...req.body,
        initiatedBy: userId
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
    const userId = getRequestUserId(req);
    const payment = await paymentService.getPaymentDetails(
      req.params.paymentId,
      userId
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
    const userId = getRequestUserId(req);
    
    const query = { user: userId };
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