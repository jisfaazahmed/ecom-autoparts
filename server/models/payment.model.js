const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,   
        ref: 'Order'
    },
    amount: {
        type: Number,
        required: true
    },
    method: {
        type: String,
        enum: ['Credit Card', 'Debit Card', 'PayPal', 'Bank Transfer'],
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    transactionId: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Payment', paymentSchema);