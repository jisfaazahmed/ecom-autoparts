const mongoose = require('mongoose');

const timelineSchema = new mongoose.Schema({

    order: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Order'
    },
    orderItem: {
        type: mongoose.Schema.Types.ObjectId
    },
    event: {
        type: String,
        required: true,
        enum: [
            'order_placed',
            'payment_pending',
            'payment_completed',
            'payment_failed',
            'cod_verification_initiated',
            'cod_verified',
            'cod_verification_failed',
            'order_confirmed',
            'processing_started',
            'ready_to_ship',
            'picked_up',
            'shipped',
            'in_transit',
            'out_for_delivery',
            'delivery_attempted',
            'delivered',
            'delivery_failed',
            'cancelled_by_customer',
            'cancelled_by_vendor',
            'cancelled_by_system',
            'return_requested',
            'return_approved',
            'return_rejected',
            'return_picked_up',
            'return_received',
            'refund_initiated',
            'refund_completed'
        ]
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    actorType: {
        type: String,
        enum: ['customer', 'vendor', 'admin', 'system', 'courier', 'guest']
    },
    location: {
        city: String,
        state: String,
        country: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    isVisible: {
        type: Boolean,
        default: true
    }
},
    {
        timestamps: true
    });

timelineSchema.index({ order: 1, createdAt: -1 });
timelineSchema.index({ orderItem: 1, createdAt: -1 });

module.exports = mongoose.model('OrderTimeLine', timelineSchema); 