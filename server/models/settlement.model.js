const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema({
    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    // Settlement period
    settlementPeriod: {
        startDate: {
            type: Date,
            required: true,
            index: true
        },
        endDate: {
            type: Date,
            required: true,
            index: true
        }
    },
    
    // Financial summary
    ordersSummary: {
        totalOrders: {
            type: Number,
            default: 0
        },
        totalOrderAmount: {
            type: Number,
            default: 0
        },
        totalRefunded: {
            type: Number,
            default: 0
        },
        netOrderAmount: {
            type: Number,
            default: 0
        }
    },
    
    // Commission & Charges
    commission: {
        rate: {
            type: Number,
            default: 0,
            min: 0,
            max: 100
        },
        totalCommission: {
            type: Number,
            default: 0
        }
    },
    
    charges: {
        platformFee: {
            type: Number,
            default: 0
        },
        paymentProcessingFee: {
            type: Number,
            default: 0
        },
        logisticsFee: {
            type: Number,
            default: 0
        },
        otherCharges: {
            type: Number,
            default: 0
        },
        totalCharges: {
            type: Number,
            default: 0
        }
    },
    
    // Final payout amount
    payableAmount: {
        type: Number,
        default: 0
    },
    
    // Payout status & tracking
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'pending',
        index: true
    },
    
    payoutMethod: {
        type: String,
        enum: ['bank_transfer', 'check', 'digital_wallet', 'credit'],
        default: 'bank_transfer'
    },
    
    // Bank details for payout
    bankDetails: {
        accountName: String,
        accountNumber: String,
        bankName: String,
        ifscCode: String,
        routingNumber: String,
        accountType: String
    },
    
    // Payout tracking
    payoutDetails: {
        transactionId: String,
        payoutDate: Date,
        confirmationDate: Date,
        failureReason: String,
        referenceNumber: String
    },
    
    // Related orders & refunds
    subOrders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubOrder'
    }],
    
    refunds: [{
        refundId: mongoose.Schema.Types.ObjectId,
        amount: Number,
        date: Date
    }],
    
    // Notes & comments
    notes: String,
    internalNotes: String,
    
    // Audit trail
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for common queries
settlementSchema.index({ vendor: 1, 'settlementPeriod.startDate': 1 });
settlementSchema.index({ vendor: 1, status: 1 });
settlementSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Settlement', settlementSchema);
