const Stripe = require('stripe');
const stripe = new Stripe(config.STRIPE_SECRET_KEY);
const config = require('../config');