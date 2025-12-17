const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    reason : {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Requested', 'Approved', 'Rejected', 'Processed'],
        default: 'Requested'
    },
    amount: {
        type: Number,
        required: true
    },
    requestedAt: {
        type: Date,
        default: Date.now
    },
    processedAt: {
        type: Date
    }
});

module.exports = mongoose.model('Refund', refundSchema);