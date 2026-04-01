const Stripe = require('stripe');

let stripe;

if (process.env.NODE_ENV === 'test' || process.env.USE_STRIPE_MOCK === 'true') {
    // Mock Stripe for testing
    stripe = {
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
