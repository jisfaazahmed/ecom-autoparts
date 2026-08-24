const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['topup', 'debit'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    balanceAfter: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'completed'
    },
    // Unique + sparse so a Stripe payment intent can only ever credit the wallet once,
    // even if the client retries the confirm call or the network drops mid-response.
    stripePaymentIntentId: {
        type: String,
        unique: true,
        sparse: true
    },
    description: String,
}, { timestamps: true });

walletTransactionSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
