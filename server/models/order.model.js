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
        required: true
    },
    items: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OrderItem'
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
    paidAmount: {
        type: Number,
        default: 0
    },

    //Status
    overallStatus: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'partially_shipped', 'shipped', 'partially_delivered', 'delivered', 'cancelled', 'refunded'],
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

    
});

orderSchema.pre('save', async function (next){
    if (this.isNew){
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2,'0');

        const count = await mongoose.model('order').countDocuments({
            createAt: {
                $gte: new Date(date.setHours(0,0,0,0)),
                $lt: new Date(date.setHours(23,59,59,999))
            }
        });

        this.orderNumber =`ORD${year}${month}${day},${String(count+1).padStart(5,'0')}`;
    }
    next();
});

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ 'items.vendor': 1, createdAt: -1 });
orderSchema.index({ overallStatus: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
