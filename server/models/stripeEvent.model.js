const mongoose = require('mongoose');

// Records every Stripe webhook event id we have accepted, so a redelivery of the
// same event is skipped instead of re-running the side effects (finalizing the
// order, generating the invoice, emailing the customer).
const stripeEventSchema = new mongoose.Schema({
    eventId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    type: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['processing', 'processed', 'failed'],
        default: 'processing'
    },
    processedAt: {
        type: Date,
        default: null
    },
    error: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Stripe retries a failed webhook for up to ~3 days; keep records a little longer
// than that so late redeliveries are still recognised as duplicates.
stripeEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

module.exports = mongoose.model('StripeEvent', stripeEventSchema);
