const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("FATAL ERROR: STRIPE_SECRET_KEY is missing from .env file!");
  // Prevent crash by exporting dummy object, but log the error
  module.exports = { paymentIntents: { create: () => {} } }; 
} else {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  module.exports = stripe;
}