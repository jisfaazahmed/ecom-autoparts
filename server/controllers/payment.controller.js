const Payment = require('../models/payment.model');
const Order = require('../models/order.model');
const paymentService = require('../services/payment.service');
const stripe = require('../config/stripe');
const OrderTimeline = require('../models/timeline.model');
const User = require('../models/user');
const WalletTransaction = require('../models/walletTransaction.model');
const invoiceService = require('../services/invoice.service');
const emailService = require('../services/email.service');

// Wallet top-up bounds (LKR)
const WALLET_TOPUP_MIN = 100;
const WALLET_TOPUP_MAX = 500000;

function getRequestUserId(req) {
  return req?.user?._id || req?.user?.id || null;
}

function getRequestUserEmail(req) {
  const email = String(req?.user?.email || '').trim();
  return email ? email : null;
}

function getRequestBillingEmail(req) {
  const bodyEmail = String(req?.body?.email || '').trim();
  if (bodyEmail) {
    return bodyEmail;
  }

  return getRequestUserEmail(req);
}

async function getOrCreatePaymentForOrder(order, userId, paymentMethod = 'card') {
  let payment = await Payment.findOne({ order: order._id });

  if (!payment) {
    payment = new Payment({
      order: order._id,
      user: userId,
      paymentMethod,
      gateway: paymentMethod === 'card' ? 'stripe' : paymentMethod,
      amount: order.totalAmount,
      totalAmount: order.totalAmount,
      currency: order.currency || 'LKR',
      status: 'pending',
      timeline: [
        {
          event: 'payment_initiated',
          timestamp: new Date(),
          description: `Payment initiated via ${paymentMethod}`,
        },
      ],
    });
  }

  return payment;
}

async function appendRetryAttempt({ payment, paymentIntent }) {
  payment.retryAttempts = payment.retryAttempts || [];
  payment.retryAttempts.push({
    attemptedAt: new Date(),
    status: paymentIntent.status,
    errorCode: paymentIntent?.last_payment_error?.code,
    errorMessage: paymentIntent?.last_payment_error?.message,
    gatewayResponse: {
      next_action: paymentIntent.next_action || null,
      paymentIntentId: paymentIntent.id,
    },
  });
  await payment.save();
  return payment.retryAttempts.length;
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

  try {
    await invoiceService.generateInvoicePdf(order._id);
  } catch (invoiceError) {
    console.error(`Invoice generation failed for order ${order.orderNumber}:`, invoiceError);
  }

  return payment;
}

function withReceiptEmail(payload, email) {
  const sanitizedEmail = String(email || '').trim();
  return sanitizedEmail ? { ...payload, receipt_email: sanitizedEmail } : payload;
}

// Credits a succeeded wallet top-up intent exactly once.
// The unique (reference, type) index on WalletTransaction is the idempotency guard,
// so the client confirm call and the Stripe webhook can both run safely.
async function creditWalletFromIntent(paymentIntent) {
  const userId = paymentIntent.metadata?.userId;
  const amount = Number(paymentIntent.amount_received || paymentIntent.amount || 0) / 100;

  if (!userId) {
    throw new Error('Wallet top-up intent is missing userId metadata');
  }

  try {
    await WalletTransaction.create({
      user: userId,
      type: 'credit',
      amount,
      currency: 'LKR',
      source: 'topup',
      reference: paymentIntent.id,
      description: 'Wallet top-up via card',
    });
  } catch (error) {
    if (error?.code === 11000) {
      const current = await User.findById(userId).select('wallet');
      return { credited: false, amount, balance: Number(current?.wallet?.balance || 0) };
    }
    throw error;
  }

  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { 'wallet.balance': amount } },
    { new: true }
  ).select('wallet');

  await WalletTransaction.updateOne(
    { reference: paymentIntent.id, type: 'credit' },
    { $set: { balanceAfter: Number(updated?.wallet?.balance || 0) } }
  );

  return { credited: true, amount, balance: Number(updated?.wallet?.balance || 0) };
}

function getIdempotencyKey(req) {
  const headerKey = String(req.get('Idempotency-Key') || req.get('idempotency-key') || '').trim();
  const bodyKey = String(req.body?.idempotencyKey || '').trim();
  const key = headerKey || bodyKey;
  if (!key) return null;
  return key.slice(0, 128);
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
            ...(userEmail ? { customer_email: userEmail } : {}),
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
    const userEmail = getRequestBillingEmail(req);

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

    const paymentIntent = await stripe.paymentIntents.create(withReceiptEmail({
      amount: Math.round(order.totalAmount * 100),
      currency: String(order.currency || 'lkr').toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        userId: String(userId),
      },
      description: `Payment for order ${order.orderNumber}`,
    }, userEmail));

    const payment = await getOrCreatePaymentForOrder(order, userId, 'card');
    payment.status = 'processing';
    payment.gateway = 'stripe';
    payment.transactionId = paymentIntent.id;
    payment.gatewayTransactionId = paymentIntent.id;
    payment.timeline.push({
      event: 'payment_processing',
      timestamp: new Date(),
      description: 'Stripe payment intent created',
    });
    await payment.save();

    order.paymentStatus = 'processing';
    order.paymentId = payment._id;
    await order.save();

    return res.status(200).json({
      success: true,
      data: {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: order.totalAmount,
        currency: order.currency || 'LKR',
        requiresAction: paymentIntent.status === 'requires_action',
        nextAction: paymentIntent.next_action || null,
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
    const userEmail = getRequestBillingEmail(req);
    const idempotencyKey = getIdempotencyKey(req);

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

    const payment = await getOrCreatePaymentForOrder(order, userId, 'card');

    if (idempotencyKey && payment?.idempotency?.confirmPaymentIntent?.key === idempotencyKey) {
      const previous = payment.idempotency.confirmPaymentIntent;

      if (previous?.status === 'completed') {
        return res.status(200).json({
          success: true,
          data: {
            orderId: order._id,
            paymentIntentId: previous.paymentIntentId || paymentIntentId,
            paymentStatus: 'completed',
          },
        });
      }

      if (previous?.status === 'requires_action') {
        return res.status(202).json({
          success: false,
          requiresAction: true,
          message: 'Additional authentication required (3DS/OTP)',
          data: {
            orderId: order._id,
            paymentIntentId: previous.paymentIntentId || paymentIntentId,
            paymentStatus: 'requires_action',
            retryCount: payment.retryAttempts?.length || 0,
            nextAction: { type: 'use_stripe_sdk' },
          },
        });
      }

      if (previous?.status === 'failed') {
        return res.status(400).json({
          success: false,
          message: 'Payment is not completed. Current status: failed',
          data: {
            orderId: order._id,
            paymentIntentId: previous.paymentIntentId || paymentIntentId,
            paymentStatus: 'failed',
            retryCount: payment.retryAttempts?.length || 0,
            retryEligible: (payment.retryAttempts?.length || 0) < 3,
          },
        });
      }

      if (previous?.status === 'processing') {
        return res.status(202).json({
          success: false,
          message: 'Payment confirmation is already being processed',
          data: {
            orderId: order._id,
            paymentIntentId: previous.paymentIntentId || paymentIntentId,
            paymentStatus: 'processing',
          },
        });
      }
    }

    if (idempotencyKey) {
      payment.idempotency = payment.idempotency || {};
      payment.idempotency.confirmPaymentIntent = {
        key: idempotencyKey,
        status: 'processing',
        paymentIntentId,
        updatedAt: new Date(),
      };
    }

    payment.transactionId = paymentIntentId;
    payment.gatewayTransactionId = paymentIntentId;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      const retryCount = await appendRetryAttempt({ payment, paymentIntent });

      if (paymentIntent.status === 'requires_action') {
        if (idempotencyKey) {
          payment.idempotency.confirmPaymentIntent = {
            key: idempotencyKey,
            status: 'requires_action',
            paymentIntentId: paymentIntent.id,
            updatedAt: new Date(),
          };
          await payment.save();
        }

        return res.status(202).json({
          success: false,
          requiresAction: true,
          message: 'Additional authentication required (3DS/OTP)',
          data: {
            orderId: order._id,
            paymentIntentId: paymentIntent.id,
            paymentStatus: paymentIntent.status,
            retryCount,
            nextAction: paymentIntent.next_action || { type: 'use_stripe_sdk' },
          },
        });
      }

      if (idempotencyKey) {
        payment.idempotency.confirmPaymentIntent = {
          key: idempotencyKey,
          status: 'failed',
          paymentIntentId: paymentIntent.id,
          updatedAt: new Date(),
        };
        await payment.save();
      }

      return res.status(400).json({
        success: false,
        message: `Payment is not completed. Current status: ${paymentIntent.status}`,
        data: {
          orderId: order._id,
          paymentIntentId: paymentIntent.id,
          paymentStatus: paymentIntent.status,
          retryCount,
          retryEligible: retryCount < 3,
        },
      });
    }

    payment.status = 'completed';
    payment.transactionId = paymentIntent.id;
    payment.gatewayTransactionId = paymentIntent.id;
    payment.timeline.push({
      event: 'payment_completed',
      timestamp: new Date(),
      description: 'Payment completed successfully via payment intent confirmation',
    });

    if (idempotencyKey) {
      payment.idempotency.confirmPaymentIntent = {
        key: idempotencyKey,
        status: 'completed',
        paymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      };
    }

    await payment.save();

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

exports.retryPaymentIntent = async (req, res) => {
  try {
    const { orderId, paymentIntentId, otp } = req.body;

    if (!orderId || !paymentIntentId) {
      return res.status(400).json({ success: false, message: 'orderId and paymentIntentId are required' });
    }

    req.body = {
      orderId,
      paymentIntentId,
      otp,
    };

    return exports.confirmPaymentIntent(req, res);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to retry payment intent' });
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

            case 'payment_intent.canceled':
                await handlePaymentIntentCanceled(event.data.object);
                break;

            case 'charge.refunded':
                await handleChargeRefunded(event.data.object);
                break;

            case 'charge.dispute.created':
                await handleDisputeCreated(event.data.object);
                break;

            case 'charge.dispute.closed':
                await handleDisputeClosed(event.data.object);
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
  // Wallet top-ups have no order attached; credit the balance and stop here.
  if (paymentIntent.metadata?.purpose === 'wallet_topup') {
    await creditWalletFromIntent(paymentIntent);
    return;
  }

  const paymentIntentId = paymentIntent.id;
  const payment = await Payment.findOne({
    $or: [
      { transactionId: paymentIntentId },
      { gatewayTransactionId: paymentIntentId },
    ],
  });

  if (payment) {
    payment.status = 'completed';
    payment.gateway = 'stripe';
    payment.transactionId = paymentIntentId;
    payment.gatewayTransactionId = paymentIntentId;
    payment.timeline.push({
      event: 'payment_completed',
      timestamp: new Date(),
      description: 'Payment intent succeeded',
    });

    await payment.save();

    const order = await Order.findById(payment.order);
    if (order) {
      await finalizeSuccessfulCardPayment({
        order,
        paymentIntentId,
        customerEmail: paymentIntent.receipt_email || paymentIntent.customer_email || null,
      });
    }
    return;
  }

  const orderId = paymentIntent?.metadata?.orderId;

  if (!orderId) {
    console.error(`Payment intent ${paymentIntent.id} is missing order metadata`);
    return;
  }

  const order = await Order.findById(orderId);
  if (!order) {
    console.error(`Order not found for payment intent ${paymentIntent.id}: ${orderId}`);
    return;
  }

  await finalizeSuccessfulCardPayment({
    order,
    paymentIntentId: paymentIntent.id,
    customerEmail: paymentIntent.receipt_email || paymentIntent.customer_email || null,
  });
}

// Helper function to handle failed payment
async function handlePaymentIntentFailed(paymentIntent) {
    const payment = await Payment.findOne({
        $or: [
            { transactionId: paymentIntent.id },
            { gatewayTransactionId: paymentIntent.id },
        ],
    });

    if (payment) {
        payment.status = 'failed';
        payment.gatewayResponse = {
            errorCode: paymentIntent.last_payment_error?.code,
            errorMessage: paymentIntent.last_payment_error?.message,
        };
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
      paymentIntentId,
      req.params.paymentId
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

exports.getWalletBalance = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const user = await User.findById(userId).select('wallet');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      data: {
        balance: Number(user.wallet?.balance || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.payWithWallet = async (req, res) => {
  try {
    const { orderId, otp } = req.body;
    const userId = getRequestUserId(req);

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const orderResult = await getAuthorizedOrder(orderId, userId);
    if (orderResult.error) {
      return res.status(orderResult.error.status).json({ success: false, message: orderResult.error.message });
    }

    const { order } = orderResult;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.wallet = user.wallet || {};
    user.wallet.balance = Number(user.wallet.balance || 0);
    user.wallet.otp = user.wallet.otp || { code: null, expiresAt: null, attempts: 0, lastSentAt: null };

    if (user.wallet.balance < Number(order.totalAmount || 0)) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance',
        data: {
          balance: user.wallet.balance,
          required: Number(order.totalAmount || 0),
        },
      });
    }

    const requiresOtp = Number(order.totalAmount || 0) >= 3000;
    if (requiresOtp) {
      const now = new Date();

      if (!otp) {
        const generatedOtp = String(Math.floor(100000 + Math.random() * 900000));

        user.wallet.otp.code = generatedOtp;
        user.wallet.otp.expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
        user.wallet.otp.lastSentAt = now;
        user.wallet.otp.attempts = 0;
        await user.save();

        await emailService.sendEmail(
          user.email,
          'Wallet payment OTP',
          `
            <h1>Wallet Payment OTP</h1>
            <p>Your one-time verification code is <strong>${generatedOtp}</strong>.</p>
            <p>This code expires in 5 minutes.</p>
            <p>If you did not request this payment, you can ignore this email.</p>
          `,
          `Your wallet payment OTP is ${generatedOtp}. It expires in 5 minutes.`
        );

        return res.status(202).json({
          success: false,
          requiresOtp: true,
          message: 'OTP verification required for wallet payment',
          data: {
            orderId: order._id,
            expiresAt: user.wallet.otp.expiresAt,
          },
        });
      }

      const validCode = String(user.wallet.otp.code || '');
      const validUntil = user.wallet.otp.expiresAt ? new Date(user.wallet.otp.expiresAt).getTime() : 0;
      const isExpired = Date.now() > validUntil;

      if (!validCode || isExpired || String(otp).trim() !== validCode) {
        user.wallet.otp.attempts = Number(user.wallet.otp.attempts || 0) + 1;
        await user.save();
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired OTP',
          data: {
            retryEligible: user.wallet.otp.attempts < 3,
          },
        });
      }
    }

    const amount = Number(order.totalAmount || 0);

    // Conditional atomic debit: the balance check and the deduction happen in one
    // operation, so concurrent orders cannot overdraw the wallet.
    const debited = await User.findOneAndUpdate(
      { _id: userId, 'wallet.balance': { $gte: amount } },
      {
        $inc: { 'wallet.balance': -amount },
        $set: { 'wallet.otp': { code: null, expiresAt: null, attempts: 0, lastSentAt: null } },
      },
      { new: true }
    ).select('wallet');

    if (!debited) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance',
        data: {
          balance: Number(user.wallet.balance || 0),
          required: amount,
        },
      });
    }

    let payment;

    try {
      await WalletTransaction.create({
        user: userId,
        type: 'debit',
        amount,
        balanceAfter: Number(debited.wallet?.balance || 0),
        currency: order.currency || 'LKR',
        source: 'order_payment',
        reference: `ORDER-${order._id}`,
        order: order._id,
        description: `Payment for order ${order.orderNumber}`,
      });

      payment = await getOrCreatePaymentForOrder(order, userId, 'wallet');
      payment.status = 'completed';
      payment.paymentMethod = 'wallet';
      payment.gateway = 'wallet';
      payment.transactionId = `WALLET-${Date.now()}`;
      payment.gatewayTransactionId = payment.transactionId;
      payment.timeline.push({
        event: 'payment_completed',
        timestamp: new Date(),
        description: 'Wallet payment completed',
      });
      await payment.save();

      await paymentService.syncOrderAfterPayment(order._id, {
        paymentStatus: 'completed',
        transactionId: payment.transactionId,
      });

      order.paymentId = payment._id;
      await order.save();
    } catch (error) {
      // Never keep the customer's money if the order could not be finalized.
      await User.updateOne({ _id: userId }, { $inc: { 'wallet.balance': amount } });
      await WalletTransaction.create({
        user: userId,
        type: 'credit',
        amount,
        currency: order.currency || 'LKR',
        source: 'reversal',
        reference: `REVERSAL-${order._id}-${Date.now()}`,
        order: order._id,
        description: `Reversal: wallet payment for order ${order.orderNumber} failed`,
      }).catch(() => {});

      throw error;
    }

    return res.json({
      success: true,
      data: {
        orderId: order._id,
        paymentId: payment._id,
        paymentStatus: 'completed',
        balance: Number(debited.wallet?.balance || 0),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Wallet payment failed' });
  }
};

// Create a Stripe PaymentIntent that funds the customer wallet.
exports.createWalletTopupIntent = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const amount = Number(req.body?.amount);

    if (!Number.isFinite(amount) || amount < WALLET_TOPUP_MIN || amount > WALLET_TOPUP_MAX) {
      return res.status(400).json({
        success: false,
        message: `Top-up amount must be between ${WALLET_TOPUP_MIN} and ${WALLET_TOPUP_MAX}`,
      });
    }

    const user = await User.findById(userId).select('email wallet');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const paymentIntent = await stripe.paymentIntents.create(withReceiptEmail({
      amount: Math.round(amount * 100),
      currency: 'lkr',
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: String(userId),
        purpose: 'wallet_topup',
      },
      description: 'Wallet top-up',
    }, user.email));

    return res.status(200).json({
      success: true,
      data: {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount,
        currency: 'LKR',
      },
    });
  } catch (error) {
    console.error('Wallet top-up intent error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to start wallet top-up' });
  }
};

// Credit the wallet once the top-up PaymentIntent has succeeded.
exports.confirmWalletTopup = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ success: false, message: 'paymentIntentId is required' });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.metadata?.purpose !== 'wallet_topup') {
      return res.status(400).json({ success: false, message: 'Payment intent is not a wallet top-up' });
    }

    if (String(paymentIntent.metadata?.userId || '') !== String(userId)) {
      return res.status(403).json({ success: false, message: 'Payment intent does not belong to this user' });
    }

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: `Top-up is not completed. Current status: ${paymentIntent.status}`,
      });
    }

    const result = await creditWalletFromIntent(paymentIntent);

    return res.status(200).json({
      success: true,
      data: {
        amount: result.amount,
        balance: result.balance,
        alreadyCredited: !result.credited,
      },
    });
  } catch (error) {
    console.error('Wallet top-up confirm error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to confirm wallet top-up' });
  }
};

// Wallet ledger for the signed-in customer.
exports.getWalletTransactions = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const [transactions, total] = await Promise.all([
      WalletTransaction.find({ user: userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      WalletTransaction.countDocuments({ user: userId }),
    ]);

    return res.json({
      success: true,
      data: {
        transactions,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
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
      message: 'Refund processed',
      data: payment,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getPaymentDetails = async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const payment = await paymentService.getPaymentDetails(req.params.paymentId, userId);

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
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

// Finds the Payment for a Stripe object by intent id, falling back to order metadata.
async function findPaymentByIntent(paymentIntentId, orderId = null) {
  if (paymentIntentId) {
    const payment = await Payment.findOne({
      $or: [
        { transactionId: paymentIntentId },
        { gatewayTransactionId: paymentIntentId },
      ],
    });

    if (payment) return payment;
  }

  return orderId ? Payment.findOne({ order: orderId }) : null;
}

async function handlePaymentIntentCanceled(paymentIntent) {
  const payment = await findPaymentByIntent(paymentIntent.id, paymentIntent?.metadata?.orderId);

  if (!payment || payment.status === 'completed') {
    return;
  }

  payment.status = 'cancelled';
  payment.timeline.push({
    event: 'payment_cancelled',
    timestamp: new Date(),
    description: paymentIntent.cancellation_reason || 'Payment intent canceled',
  });
  await payment.save();

  const order = await Order.findById(payment.order);
  if (order) {
    order.paymentStatus = 'failed';
    await order.save();
  }
}

// Refunds issued directly from the Stripe dashboard never pass through our API,
// so mirror them onto the payment record here.
async function handleChargeRefunded(charge) {
  const payment = await findPaymentByIntent(charge.payment_intent);

  if (!payment) {
    return;
  }

  const refundedTotal = Number(charge.amount_refunded || 0) / 100;
  const known = (payment.refunds || [])
    .filter((refund) => refund.status === 'completed')
    .reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
  const delta = refundedTotal - known;

  if (delta <= 0) {
    return;
  }

  payment.refunds = payment.refunds || [];
  payment.refunds.push({
    refundId: `STRIPE-${charge.id}`,
    amount: delta,
    reason: 'requested_by_customer',
    status: 'completed',
    processedAt: new Date(),
    gatewayRefundId: charge.id,
    refundMethod: 'original_method',
    notes: 'Refund recorded from Stripe webhook',
  });

  await paymentService.applyRefundStatus(payment, delta);
  await payment.save();
}

async function handleDisputeCreated(dispute) {
  const payment = await findPaymentByIntent(dispute.payment_intent);

  if (!payment) {
    console.error(`Dispute ${dispute.id} could not be matched to a payment`);
    return;
  }

  payment.timeline.push({
    event: 'chargeback_initiated',
    timestamp: new Date(),
    description: `Chargeback opened (${dispute.reason || 'unspecified'}) for ${dispute.currency?.toUpperCase()} ${Number(dispute.amount || 0) / 100}`,
  });
  payment.gatewayResponse = {
    errorCode: dispute.reason,
    errorMessage: `Dispute ${dispute.id} status: ${dispute.status}`,
  };
  await payment.save();

  await OrderTimeline.create({
    order: payment.order,
    event: 'payment_failed',
    title: 'Chargeback Opened',
    description: `A chargeback was opened for this order (${dispute.reason || 'unspecified'})`,
    actorType: 'system',
    metadata: { disputeId: dispute.id, status: dispute.status },
  });
}

async function handleDisputeClosed(dispute) {
  const payment = await findPaymentByIntent(dispute.payment_intent);

  if (!payment) {
    return;
  }

  const lost = dispute.status === 'lost';

  payment.timeline.push({
    event: 'chargeback_resolved',
    timestamp: new Date(),
    description: `Chargeback ${dispute.status}`,
  });

  if (lost) {
    payment.status = 'refunded';

    const order = await Order.findById(payment.order);
    if (order) {
      order.paymentStatus = 'refunded';
      order.overallStatus = 'refunded';
      await order.save();
    }
  }

  await payment.save();
}

exports.__testHooks = {
  handleCheckoutSessionCompleted,
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
  handlePaymentIntentCanceled,
  handleChargeRefunded,
  handleDisputeCreated,
  handleDisputeClosed,
  finalizeSuccessfulCardPayment,
};

module.exports = exports;