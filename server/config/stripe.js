const Stripe = require('stripe');

<<<<<<< HEAD
if (!process.env.STRIPE_SECRET_KEY) {
  console.error("FATAL ERROR: STRIPE_SECRET_KEY is missing from .env file!");
  // Prevent crash by exporting dummy object, but log the error
  module.exports = { paymentIntents: { create: () => {} } }; 
} else {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  module.exports = stripe;
}
=======
let stripe;

// Use internal mock only during automated tests (NODE_ENV=test).
// Runtime mocking via `USE_STRIPE_MOCK` has been removed to avoid accidental mock usage
// when developers are running the app locally with real Stripe test keys.
if (process.env.NODE_ENV === 'test') {
    const mockPaymentIntents = new Map();

    // Mock Stripe for testing
    stripe = {
        paymentIntents: {
            create: async (data) => {
                const id = 'pi_mock_' + Date.now();
                const mockScenario = data?.metadata?.mockScenario || null;
                const paymentIntent = {
                    id,
                    amount: data.amount,
                    currency: data.currency || 'lkr',
                    status: mockScenario === 'requires_action' ? 'requires_action' : 'requires_confirmation',
                    client_secret: `${id}_secret_mock`,
                    metadata: data.metadata || {},
                    charges: { data: [] },
                    mockScenario,
                    mockOtpCode: data?.metadata?.mockOtpCode || '123456',
                    mockRetryCount: 0,
                    next_action: mockScenario === 'requires_action'
                        ? { type: 'use_stripe_sdk', display_message: '3DS/OTP verification required' }
                        : null,
                };
                mockPaymentIntents.set(id, paymentIntent);
                console.log('Mock Stripe: Creating payment intent', paymentIntent);
                return paymentIntent;
            },
            confirm: async (paymentIntentId, params = {}) => {
                const paymentIntent = mockPaymentIntents.get(paymentIntentId) || {
                    id: paymentIntentId,
                    status: 'requires_confirmation',
                    charges: { data: [] },
                    mockScenario: null,
                    mockOtpCode: '123456',
                    mockRetryCount: 0,
                };

                paymentIntent.mockRetryCount = (paymentIntent.mockRetryCount || 0) + 1;

                if (paymentIntent.mockScenario === 'requires_action') {
                    const otp = String(params?.payment_method_options?.card?.mock_otp || params?.mockOtp || '').trim();
                    if (otp !== paymentIntent.mockOtpCode) {
                        if (paymentIntent.mockRetryCount >= 3) {
                            paymentIntent.status = 'payment_failed';
                            paymentIntent.last_payment_error = {
                                code: 'authentication_failed',
                                message: '3DS/OTP verification failed',
                            };
                            paymentIntent.next_action = null;
                        } else {
                            paymentIntent.status = 'requires_action';
                            paymentIntent.last_payment_error = {
                                code: 'authentication_required',
                                message: 'OTP required to complete authentication',
                            };
                            paymentIntent.next_action = { type: 'use_stripe_sdk', display_message: 'Provide OTP to continue' };
                        }
                        mockPaymentIntents.set(paymentIntentId, paymentIntent);
                        return paymentIntent;
                    }
                }

                if (paymentIntent.mockScenario === 'always_fail') {
                    paymentIntent.status = 'payment_failed';
                    paymentIntent.last_payment_error = {
                        code: 'card_declined',
                        message: 'Card was declined',
                    };
                    mockPaymentIntents.set(paymentIntentId, paymentIntent);
                    return paymentIntent;
                }

                if (paymentIntent.mockScenario === 'fail_once' && paymentIntent.mockRetryCount === 1) {
                    paymentIntent.status = 'payment_failed';
                    paymentIntent.last_payment_error = {
                        code: 'processing_error',
                        message: 'Temporary processing failure, retry allowed',
                    };
                    mockPaymentIntents.set(paymentIntentId, paymentIntent);
                    return paymentIntent;
                }

                paymentIntent.status = 'succeeded';
                paymentIntent.next_action = null;
                paymentIntent.charges = {
                    data: [
                        {
                            id: 'ch_mock_' + Date.now(),
                            receipt_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/success?mock=1`,
                        },
                    ],
                };

                mockPaymentIntents.set(paymentIntentId, paymentIntent);
                console.log('Mock Stripe: Confirming payment intent', paymentIntentId);
                return paymentIntent;
            },
            retrieve: async (paymentIntentId) => {
                const paymentIntent = mockPaymentIntents.get(paymentIntentId);

                if (!paymentIntent) {
                    return {
                        id: paymentIntentId,
                        status: 'succeeded',
                        next_action: null,
                        charges: {
                            data: [
                                {
                                    id: 'ch_mock_' + Date.now(),
                                    receipt_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/success?mock=1`,
                                },
                            ],
                        },
                    };
                }

                if (paymentIntent.status !== 'succeeded') {
                    // Keep non-succeeded status as-is to support retry/3DS tests.
                    mockPaymentIntents.set(paymentIntentId, paymentIntent);
                }

                return paymentIntent;
            },
        },
        checkout: {
            sessions: {
                create: async (data) => {
                    console.log('Mock Stripe: Creating checkout session', data);
                    return {
                        id: 'cs_test_mock_' + Date.now(),
                        url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/success?session_id=cs_test_mock_${Date.now()}&order_id=${data.metadata?.orderId || 'mock'}`,
                        payment_status: 'paid'
                    };
                }
            }
        },
        webhooks: {
            constructEvent: (body) => {
                console.log('Mock Stripe: Constructing webhook event');
                // body should contain the session data from the checkout creation
                return {
                    type: 'checkout.session.completed',
                    data: {
                        object: {
                            id: body.id || 'cs_test_mock_' + Date.now(),
                            payment_status: 'paid',
                            payment_intent: 'pi_mock_' + Date.now(),
                            customer_email: body.customer_email,
                            metadata: body.metadata || {},
                            client_reference_id: body.client_reference_id || body.metadata?.orderId
                        }
                    }
                };
            }
        }
    };
} else {
    if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

module.exports = stripe;
>>>>>>> origin/feature/seller
