const mongoose = require('mongoose');

const inventoryReservationSchema = new mongoose.Schema({
    // Product being reserved
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    },

    // User who made the reservation
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Order if reservation is linked to order
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        index: true
    },

    // Cart if reservation is from cart
    cart: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cart'
    },

    // OrderItem for multi-seller support
    orderItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrderItem'
    },

    // Quantity reserved
    quantity: {
        type: Number,
        required: true,
        min: 1
    },

    // Reservation status
    status: {
        type: String,
        enum: ['reserved', 'confirmed', 'released', 'expired', 'converted_to_order'],
        default: 'reserved',
        index: true
    },

    // Expiration time - reservations auto-expire after this time
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },

    // When was this reservation confirmed/converted to order
    confirmedAt: Date,

    // When was this reservation released
    releasedAt: Date,

    // Reason for release if applicable
    releaseReason: {
        type: String,
        enum: ['expired', 'cancelled_by_user', 'order_cancelled', 'payment_failed', 'stock_issue'],
        default: null
    },

    // Session/Cart session ID for guest checkouts
    sessionId: String,

    // Notes
    notes: String

}, { timestamps: true });

// Index for active reservations per product
inventoryReservationSchema.index({ product: 1, status: 1 });

// Index for user's active reservations
inventoryReservationSchema.index({ user: 1, status: 1 });

// Index for expiring reservations
inventoryReservationSchema.index({ expiresAt: 1, status: 1 });

// Fast path for stock checks and active reservation reads
inventoryReservationSchema.index({ product: 1, status: 1, expiresAt: 1 });
inventoryReservationSchema.index({ user: 1, product: 1, status: 1, expiresAt: 1 });
inventoryReservationSchema.index({ order: 1, status: 1 });

// TTL index to auto-delete expired reservations after 30 days
inventoryReservationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });

module.exports = mongoose.model('InventoryReservation', inventoryReservationSchema);

