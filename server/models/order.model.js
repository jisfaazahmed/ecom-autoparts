const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    custamerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer'
    },
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seller'
    },
    totalAmount : Number,
    status: {
        type: String,
        enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Order', orderSchema);
    