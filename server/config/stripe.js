const Stripe = require('stripe');

let stripe;

if (process.env.NODE_ENV === 'test' || process.env.USE_STRIPE_MOCK === 'true') {
    const mockPaymentIntents = new Map();

    // Mock Stripe for testing
    stripe = {
        paymentIntents: {
            create: async (data) => {
                const id = 'pi_mock_' + Date.now();
                const paymentIntent = {
                    id,
                    amount: data.amount,
                    currency: data.currency || 'lkr',
                    status: 'requires_confirmation',
                    client_secret: `${id}_secret_mock`,
                    metadata: data.metadata || {},
                    charges: { data: [] },
                };
                mockPaymentIntents.set(id, paymentIntent);
                console.log('Mock Stripe: Creating payment intent', paymentIntent);
                return paymentIntent;
            },
            confirm: async (paymentIntentId) => {
                const paymentIntent = mockPaymentIntents.get(paymentIntentId) || {
                    id: paymentIntentId,
                    status: 'requires_confirmation',
                    charges: { data: [] },
                };

                paymentIntent.status = 'succeeded';
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
                    paymentIntent.status = 'succeeded';
                    paymentIntent.charges = {
                        data: [
                            {
                                id: 'ch_mock_' + Date.now(),
                                receipt_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/success?mock=1`,
                            },
                        ],
                    };
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
