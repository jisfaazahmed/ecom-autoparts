const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
<<<<<<< HEAD
    orderId: {
        type: mongoose.Schema.Types.ObjectId,   
        ref: 'Order'
    },
=======
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    paymentNumber: {
        type: String,
        unique: true,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'card', 'wallet'],
        required: true
    },
    //card
    cardDetails: {
        cardType: {
            type: String,
            enum: ['credit', 'debit']
        },
        cardBrand: String,
        last4Digits: String,
        expiryMonth: String,
        expiryYear: String,
        cardHolderName: String,
    },
>>>>>>> origin/feature/seller
    amount: {
        type: Number,
        required: true
    },
<<<<<<< HEAD
    method: {
        type: String,
        enum: ['Credit Card', 'Debit Card', 'PayPal', 'Bank Transfer'],
=======
    totalAmount: {
        type: Number,
>>>>>>> origin/feature/seller
        required: true
    },
    status: {
        type: String,
<<<<<<< HEAD
        enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
        default: 'Pending'
    },
    transactionId: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

=======
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
        default: 'pending'
    },
    currency: {
        type: String,
        default: 'LKR'
    },

    //transection
    transactionId: String,
    gatewayTransactionId: String,
    gatewayOrderId: String,
    gateway: {
        type: String,
        required: false,
        default: function() {
            const method = String(this.paymentMethod || '').toLowerCase();
            if (method === 'card') return 'stripe';
            if (method === 'cod') return 'cod';
            return 'manual';
        }
    },

    //COD
    codDetails: {
        verificationStatus: {
            type: String,
            enum: ['pending', 'verified', 'failed', 'not_required'],
            default: 'pending'
        },
        verificationAttempts: [{
            attemptedAt: Date,
            attemptedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            method: {
                type: String,
                enum: ['call', 'sms']
            },
            status: {
                type: String,
                enum: ['success', 'no_answer', 'wrong_number', 'customer_refused', 'number_busy']
            },
            notes: String
        }],
        collectionStatus: {
            type: String,
            enum: ['pending', 'collected', 'failed', 'returned'],
            default: 'pending'
        },
        collectedAmount: Number,
        // Delivery agent name
        collectedBy: String,
        collectedDate: Date,
        collectionProof: {
            signature: String,
            notes: String
        }
    },

    //timeline
    timeline: [{
        event: {
            type: String,
            enum: [
                'payment_initiated',
                'payment_processing',
                'payment_completed',
                'payment_failed',
                'payment_cancelled',
                'refund_initiated',
                'refund_processing',
                'refund_completed',
                'refund_failed',
                'chargeback_initiated',
                'chargeback_resolved',
            ],
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        description: String,
    }],

    refunds: [{
        refundId: String,
        amount: Number,
        reason: String,
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed']
        },
        initiatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        initiatedAt: Date,
        processedAt: Date,
        gatewayRefundId: String,
        refundMethod: String,
        accountDetails: mongoose.Schema.Types.Mixed,
        estimatedCompletionDate: Date,
        actualCompletionDate: Date,
        notes: String
    }],

    retryAttempts: [{
    attemptedAt: Date,
    status: String,
    errorCode: String,
    errorMessage: String,
    gatewayResponse: mongoose.Schema.Types.Mixed
  }],
  
}, {
    timestamps: true
});

// Create unique payment number before validation so required:true passes.
paymentSchema.pre('validate', async function(next) {
    if (!this.isNew || this.paymentNumber) {
        return next();
    }

    try {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const count = await mongoose.model('Payment').countDocuments({
            createdAt: {
                $gte: startOfDay,
                $lt: endOfDay
            }
        });

        this.paymentNumber = `PAY${year}${month}${day}${String(count + 1).padStart(6, '0')}`;
        return next();
    } catch (error) {
        return next(error);
    }
});

// Add timeline event
paymentSchema.methods.addTimelineEvent = function(event, description, metadata = {}) {
  this.timeline.push({
    event,
    timestamp: new Date(),
    description,
    metadata
  });
};

// Index for faster queries
paymentSchema.index({ order: 1 });
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({paymentMethod : 1});
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ gateway: 1 });


>>>>>>> origin/feature/seller
module.exports = mongoose.model('Payment', paymentSchema);