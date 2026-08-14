const mongoose = require('mongoose');

const subOrderSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        index: true
    },
    items: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrderItem',
        required: true
    }],
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'return_requested', 'returned', 'refunded'],
        default: 'pending',
        index: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'],
        default: 'pending'
    },
    subtotal: {
        type: Number,
        default: 0
    },
    shippingCharge: {
        type: Number,
        default: 0
    },
    taxAmount: {
        type: Number,
        default: 0
    },
    discountAmount: {
        type: Number,
        default: 0
    },
    commissionRate: {
        type: Number,
        default: 0
    },
    commissionAmount: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        default: 0
    },
    shippingAddress: {
        fullName: String,
        phone: String,
        alternatePhone: String,
        addressLine1: String,
        addressLine2: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
        landmark: String,
        addressType: String,
    },
    shippingMethod: {
        type: String,
        enum: ['standard', 'express', 'same_day', 'pickup_point'],
        default: 'standard'
    },
    trackingNumber: String,
    courierPartner: String,
    estimatedDeliveryDate: Date,
    actualDeliveryDate: Date,
    notes: String,
}, { timestamps: true });

subOrderSchema.index({ order: 1, seller: 1 }, { unique: true });
subOrderSchema.index({ seller: 1, createdAt: -1 });

module.exports = mongoose.model('SubOrder', subOrderSchema);
