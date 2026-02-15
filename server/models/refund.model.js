const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        require: true
    },
    orderItem: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    payment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment'
    },
    requestNumber: {
        type: String,
        unique: true,
        required: true
    },
    refundTyep: {
        type: String,
        require: true
    }
    ,
    returnReason: {
        category: {
            type: String,
            enum: [
                'defective_product',
                'wrong_item',
                'not_as_described',
                'damaged_in_transit',
                'missing_parts',
                'size_issue',
                'color_difference',
                'quality_issue',
                'changed_mind',
                'late_delivery',
                'duplicate_order',
                'other'
            ],
            required: true
        },
        subcategory: String,
        description: {
            type: String,
            required: true
        },
        detailedExplanation: String
    },

    productCondition: {
        packaging: {
            type: String,
            enum: ['unopened', 'opened', 'damaged', 'missing']
        },
        productState: {
            type: String,
            enum: ['new_unused', 'used', 'damaged', 'defective']
        },
        accessories: {
            type: String,
            enum: ['all_included', 'missing_some', 'missing_all', 'not_applicable']
        },
        returnEligible: {
            type: Boolean,
            default: true
        },
        nonReturnableReason: String
    },

    evidence: {
        photos: [{
            url: String,
            caption: String,
            uploadedAt: {
                type: Date,
                default: Date.now
            }
        }],
        unboxingVideo: String,
        defectProof: [String]
    },

    product: {
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        name: String,
        sku: String,
        variant: String,
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: Number,
        totalAmount: Number
    },

    refundAmount: {
        itemAmount: {
            type: Number,
            required: true
        },
        shippingRefund: {
            type: Number,
            default: 0
        },
        deductions: {
            returnShippingCharge: {
                type: Number,
                default: 0
            },
            packagingDamage: {
                type: Number,
                default: 0
            },
            usageCharge: {
                type: Number,
                default: 0
            },
            other: {
                amount: Number,
                reason: String
            }
        },
        totalRefund: {
            type: Number,
            required: true
        },
        currency: {
            type: String,
            default: 'LKR'
        }
    },

    returnShipping: {
        required: {
            type: Boolean,
            default: true
        },
        method: {
            type: String,
            enum: ['courier_pickup', 'self_drop', 'no_return_needed']
        },
        courierPartner: {
            type: String,
            enum: ['pronto', 'domex', 'aramex', 'dhl_sri_lanka', 'self']
        },
        trackingNumber: String,
        pickupAddress: {
            fullName: String,
            phone: String,
            addressLine1: String,
            addressLine2: String,
            district: String,
            postalCode: String,
        },
        pickupScheduled: {
            date: Date,
            timeSlot: {
                start: String,
                end: String
            }
        },
        pickupAttempts: [{
            attemptDate: Date,
            status: {
                type: String,
                enum: ['success', 'failed', 'customer_not_available', 'rescheduled']
            },
            reason: String,
            nextAttemptDate: Date,
            notes: String
        }],
        pickedUpDate: Date,
        receivedAtWarehouse: Date,
        shippingCost: {
            type: Number,
            default: 0
        },
        paidBy: {
            type: String,
            enum: ['customer', 'vendor', 'platform'],
            default: 'vendor'
        }
    },

    qualityCheck: {
        required: {
            type: Boolean,
            default: true
        },
        status: {
            type: String,
            enum: ['pending', 'in_progress', 'passed', 'failed', 'not_required'],
            default: 'pending'
        },
        inspectedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        inspectionDate: Date,
        findings: {
            packaging: {
                condition: {
                    type: String,
                    enum: ['excellent', 'good', 'fair', 'poor', 'damaged']
                },
                notes: String
            },
            product: {
                condition: {
                    type: String,
                    enum: ['new', 'like_new', 'used', 'damaged', 'defective']
                },
                defects: [String],
                notes: String
            },
            accessories: {
                complete: Boolean,
                missing: [String],
                notes: String
            }
        },
        photos: [String],
        result: {
            approved: Boolean,
            refundPercentage: {
                type: Number,
                min: 0,
                max: 100,
                default: 100
            },
            deductionReason: String,
            notes: String
        },
        customerNotified: {
            type: Boolean,
            default: false
        },
        customerResponse: {
            accepted: Boolean,
            comments: String,
            respondedAt: Date
        }
    },

    refundMethod: {
        type: {
            type: String,
            required: true
        },
        bankDetails: {
            bankName: String,
            branchName: String,
            accountHolderName: String,
            accountNumber: String,
            accountType: {
                type: String,
                enum: ['savings', 'current']
            }
        },
    },

    // Status and Timeline
    status: {
        type: String,
        enum: [
            'requested',
            'pending_review',
            'approved',
            'rejected',
            'pickup_scheduled',
            'picked_up',
            'in_transit',
            'received_at_warehouse',
            'quality_check_in_progress',
            'quality_check_passed',
            'quality_check_failed',
            'refund_processing',
            'refund_completed',
            'exchange_processing',
            'exchange_completed',
            'cancelled',
            'disputed'
        ],
        default: 'requested'
    },

    statusHistory: [{
        status: String,
        timestamp: {
            type: Date,
            default: Date.now
        },
        note: String,
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        userType: {
            type: String,
            enum: ['customer', 'vendor', 'admin', 'system']
        }
    }],

    vendorReview: {
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'needs_info'],
            default: 'pending'
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reviewedAt: Date,
        comments: String,
        approvalReason: String,
        rejectionReason: String
    },

    adminReview: {
        required: {
            type: Boolean,
            default: false
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reviewedAt: Date,
        comments: String
    },

    deadlines: {
        returnWindowExpiry: Date,
        pickupDeadline: Date,
        qualityCheckDeadline: Date,
        vendorResponseDeadline: Date,
        refundProcessingDeadline: Date
    },

    refundProcessing: {
        initiatedAt: Date,
        initiatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        processedAt: Date,
        transactionId: String,
        referenceNumber: String,
        paymentGatewayResponse: mongoose.Schema.Types.Mixed,
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed']
        },
        failureReason: String,
        retryAttempts: {
            type: Number,
            default: 0
        }
    },

    feedback: {
        rating: {
            type: Number,
            min: 1,
            max: 5
        },
        processRating: {
            type: Number,
            min: 1,
            max: 5
        },
        comments: String,
        submittedAt: Date,
        wouldRecommend: Boolean
    },

    internalNotes: [{
        note: String,
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        addedAt: {
            type: Date,
            default: Date.now
        },
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'urgent']
        },
        category: {
            type: String,
            enum: ['general', 'quality_issue', 'fraud_alert', 'customer_service', 'logistics']
        }
    }],

    policyViolations: [{
        type: {
            type: String,
            enum: ['excessive_returns', 'fraud_suspected', 'abuse_of_policy', 'damaged_intentionally']
        },
        severity: {
            type: String,
            enum: ['warning', 'flag', 'block']
        },
        description: String,
        detectedAt: Date,
        actionTaken: String
    }],

});

// Generate unique request number
refundSchema.pre('save', async function (next) {
    if (this.isNew && !this.requestNumber) {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        const count = await mongoose.model('Refund').countDocuments({
            createdAt: {
                $gte: new Date(date.setHours(0, 0, 0, 0)),
                $lt: new Date(date.setHours(23, 59, 59, 999))
            }
        });

        this.requestNumber = `RFN${year}${month}${day}${String(count + 1).padStart(5, '0')}`;
    }
    next();
});


// Indexes
refundSchema.index({ requestNumber: 1 });
refundSchema.index({ order: 1 });
refundSchema.index({ customer: 1, status: 1 });
refundSchema.index({ vendor: 1, status: 1 });
refundSchema.index({ status: 1 });
refundSchema.index({ createdAt: -1 });
refundSchema.index({ 'deadlines.returnWindowExpiry': 1 });
refundSchema.index({ 'qualityCheck.status': 1 });
refundSchema.index({ 'refundProcessing.status': 1 });

module.exports = mongoose.model('Refund', refundSchema);