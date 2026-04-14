const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    items: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrderItem'
    }],

    subOrders: [{
        vendor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        items: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'OrderItem'
        }],
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'return_requested', 'returned', 'refunded'],
            default: 'pending'
        },
        subtotal: {
            type: Number,
            default: 0
        },
        trackingNumber: String,
        courierPartner: String,
        updatedAt: Date
    }],

    shippingAddress: {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        alternatePhone: String,
        addressLine1: { type: String, required: true },
        addressLine2: String,
        city: { type: String, required: true },
        state: String,
        postalCode: { type: String, required: true },
        country: { type: String, required: true },
        landmark: String,
        addressType: {
            type: String,
            enum: ['home', 'office', 'other'],
            default: 'home'
        }
    },

    billingAddress: {
        fullName: String,
        phone: String,
        addressLine1: String,
        addressLine2: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
        sameAsShipping: {
            type: Boolean,
            default: true
        }
    },

    itemsTotal: {
        type: Number,
        required: true
    },
    shippingCharges: {
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
    couponDiscount: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true
    },

    //Pyment
    paymentMethod: {
        type: String,
        enum: ['cod', 'card', 'wallet', 'bank_transfer', 'installment'],
        required: true
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'],
        default: 'pending'
    },
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
    transectionId: String,
    transactionId: String, // Stripe/payment gateway transaction ID
    stripeSessionId: String, // Stripe checkout session ID
    paidAmount: {
        type: Number,
        default: 0
    },
    currency: {
        type: String,
        default: 'LKR'
    },

    //Status
    overallStatus: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'ready_to_ship', 'partially_shipped', 'shipped', 'out_for_delivery', 'partially_delivered', 'delivered', 'cancelled', 'refunded'],
        default: 'pending'
    },

    //Delivery
    shippingMethod: {
        type: String,
        enum: ['standard', 'express', 'same_day', 'pickup_point'],
        default: 'standard'
    },
    courierPartner: String,
    masterTrackingNumber: String,
    estimatedDeliveryDate: Date,
    actualDeliveryDate: Date,
    deliveryTimeSlot: {
        date: Date,
        startTime: String,
        endTime: String
    },

    deliveryAttempts: [{
        attemptDate: Date,
        status: {
            type: String,
            enum: ['delivered', 'failed', 'rescheduled', 'customer_not_available']
        },
        reason: String,
        attemptedBy: String,
        notes: String,
        proofOfDelivery: {
            image: String,
            signature: String,
            receivedBy: String
        }
    }],

    //Cancelation
    cancellationRequest: {
        requestedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        requestedAt: Date,
        reason: String,
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected']
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        approvedAt: Date,
        rejectionReason: String
    },

    
}, { timestamps: true });

orderSchema.pre('validate', async function (next) {
    if (this.orderNumber) return next();

    try {
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const count = await this.constructor.countDocuments({
            createdAt: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        });

        const year = now.getFullYear().toString().slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');

        this.orderNumber = `ORD${year}${month}${day}-${String(count + 1).padStart(5, '0')}`;
        next();
    } catch (err) {
        next(err);
    }
});

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ 'items.vendor': 1, createdAt: -1 });
orderSchema.index({ overallStatus: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
