const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    balanceAfter: {
        type: Number,
        default: null
    },
    currency: {
        type: String,
        default: 'LKR'
    },
    source: {
        type: String,
        enum: ['topup', 'refund', 'order_payment', 'reversal', 'adjustment'],
        required: true
    },
    // Gateway/payment identifier this movement is tied to. Unique per type so the
    // same Stripe intent or order can never be credited/debited twice.
    reference: {
        type: String,
        default: null
    },
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },
    payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        default: null
    },
    description: String,
}, {
    timestamps: true
});

walletTransactionSchema.index({ user: 1, createdAt: -1 });
walletTransactionSchema.index(
    { reference: 1, type: 1 },
    { unique: true, partialFilterExpression: { reference: { $type: 'string' } } }
);

module.exports = mongoose.model('WalletTransaction', walletTransactionSchema);
