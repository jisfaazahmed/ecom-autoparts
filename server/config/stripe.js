const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
}

module.exports = new Stripe(stripeSecretKey);
