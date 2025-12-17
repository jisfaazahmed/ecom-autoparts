const mongoose = require('mongoose');

const shippingSchema = new mongoose.Schema({
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    address: {  
        type: String,
        required: true
    },
    city: {  
        type: String,
        required: true
    },
    postalCode: {  
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Shipped', 'Delivered', 'Returned'],
        default: 'Pending'
    },
    shippedAt: {
        type: Date  
    },
    deliveredAt: {
        type: Date  
    },
    courier: {  
        type: String
    },
    trackingNumber: {  
        type: String
    },
    shippingCost: {  
        type: Number
    }
});

module.exports = mongoose.model('Shipping', shippingSchema);