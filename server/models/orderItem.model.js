const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    },
    quantity: { 
        type: Number,
        required: true
    },
    price: { 
        type: Number,
        required: true
    }
});

module.exports = mongoose.model('OrderItem', orderItemSchema);