const Stripe = require('stripe');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

let stripe;
if (!stripeSecretKey) {
    console.warn("⚠️ WARNING: STRIPE_SECRET_KEY environment variable is not set. Stripe functionality will not work.");
    stripe = {
        paymentIntents: {
            create: async () => {
                throw new Error("Stripe is not configured. Please set STRIPE_SECRET_KEY.");
            }
        }
    };
} else {
    stripe = new Stripe(stripeSecretKey);
}

module.exports = stripe;
