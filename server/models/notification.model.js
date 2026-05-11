const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // User receiving the notification
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Notification type
    type: {
        type: String,
        enum: ['order_placed', 'order_confirmed', 'order_shipped', 'order_delivered', 'order_cancelled', 'shipping_update', 'refund_initiated', 'refund_completed', 'payment_failed', 'payment_success', 'vendor_order_alert', 'admin_vendor_applied', 'admin_product_added', 'admin_customer_signup', 'vendor_application_approved', 'vendor_application_rejected', 'order_processing', 'order_out_for_delivery', 'vendor_order_delivered'],
        required: true,
        index: true
    },

    // Reference to order
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },

    // Reference to refund
    refund: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Refund'
    },

    // Notification details
    title: {
        type: String,
        required: true
    },

    message: {
        type: String,
        required: true
    },

    // Additional data for rich notifications
    data: {
        orderNumber: String,
        trackingNumber: String,
        courierPartner: String,
        refundAmount: Number,
        paymentMethod: String,
        reason: String
    },

    // Read/unread status
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },

    // Read timestamp
    readAt: Date,

    // Priority
    priority: {
        type: String,
        enum: ['low', 'normal', 'high'],
        default: 'normal'
    },

    // Notification channel
    channel: {
        type: String,
        enum: ['in_app', 'email', 'sms', 'push'],
        default: 'in_app'
    },

    // Delivery status for multi-channel
    deliveryStatus: {
        type: String,
        enum: ['pending', 'sent', 'failed', 'delivered'],
        default: 'pending'
    },

    // Attempt count for retries
    attemptCount: {
        type: Number,
        default: 0
    },

    // Last attempt timestamp
    lastAttemptAt: Date

}, { timestamps: true });

// Index for user notifications sorted by date
notificationSchema.index({ user: 1, createdAt: -1 });

// Index for unread notifications
notificationSchema.index({ user: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);

