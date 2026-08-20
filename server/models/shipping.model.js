const mongoose = require('mongoose');

const shippingSchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        require: true
    },
    orderItem: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    trackingNumber: {
        type: String,
        unique: true,
        required: true
    },

    package: {
        weight: {
            type: Number,
            required: true,
            min: 0
        },
        weightUnit: {
            type: String,
            enum: ['kg', 'g'],
            default: 'g'
        },
        dimensions: {
            length: Number,
            width: Number,
            height: Number,
            unit: {
                type: String,
                enum: ['mm', 'cm', 'm'],
                default: 'mm'
            }
        },
        volumetricWeight: Number,
        fragile: {
            type: Boolean,
            default: false
        },
        packageType: {
            type: String,
            enum: ['box', 'parcel']
        },
        packageValue: Number,
        description: String,
        specialInstructions: String
    },

    delivery: {
        estimatedDate: Date,
        estimatedTimeSlot: {
            start: String,
            end: String
        },
        actualDeliveryDate: Date,
        deliveryTime: String,
        deliveredBy: {
            name: String,
            phone: String,
            vehicleNumber: String,
            photo: String
        },
        receivedBy: {
            name: String,
            relationship: {
                type: String,
                enum: ['self', 'family', 'friend', 'security', 'neighbor', 'office_staff']
            },
            idType: String,
            idNumber: String
        },
        proofOfDelivery: {
            signature: String,
            photo: String,
            otp: String,
            timestamp: Date
        },
        deliveryInstructions: String,
        deliveryNotes: String,
        contactlessDelivery: {
            type: Boolean,
            default: false
        }
    },

    deliveryAttempts: [{
        attemptNumber: Number,
        attemptDate: Date,
        attemptTime: String,
        status: {
            type: String,
            enum: ['delivered', 'failed', 'rescheduled', 'customer_not_available', 'wrong_address']
        },
        reason: String,
        failureReason: String,
        nextAttemptDate: Date,
        attemptedBy: String,
        contactNumber: String,
        notes: String,
    }],

    pickupAddress: {
        warehouseName: String,
        contactPerson: String,
        phone: String,
        addressLine1: String,
        addressLine2: String,
        city: String,
        district: String,
        province: String,
        postalCode: String,
    },

    pickup: {
        scheduledDate: Date,
        scheduledTimeSlot: {
            start: String,
            end: String
        },
        actualPickupDate: Date,
        pickupTime: String,
        pickedUpBy: {
            name: String,
            phone: String,
            vehicleNumber: String
        },
        pickupAttempts: [{
            attemptDate: Date,
            status: String,
            reason: String,
            notes: String
        }]
    },

    status: {
        type: String,
        enum: [
            'label_created',
            'pickup_scheduled',
            'picked_up',
            'in_transit',
            'out_for_delivery',
            'delivered',
            'delivery_attempted',
            'failed',
            'returned_to_sender',
            'cancelled',
            'on_hold',
            'lost',
            'damaged'
        ],
        default: 'label_created'
    },

    trackingEvents: [{
        status: String,
        location: {
            city: String,
            district: String,
            facility: String,
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        description: String,
        scannedBy: String,
    }],

    shipmentType: {
        type: String,
        enum: ['standard', 'express', 'same_day', 'next_day', 'pickup_point'],
        default: 'standard'
    },

    shippingAddress: {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        alternatePhone: String,
        addressLine1: { type: String, required: true },
        addressLine2: String,
        city: { type: String, required: true },
        district: String,
        province: String,
        postalCode: { type: String, required: true },
        country: { type: String, default: 'Sri Lanka' },
        landmark: String,
        addressType: {
            type: String,
            enum: ['home', 'office', 'other'],
            default: 'home'
        },
    },
    shippingCost: {
        baseCharge: {
            type: Number,
            required: true
        },
        weightCharge: Number,
        zoneCharge: Number,
        packagingCharges: Number,
        handlingCharges: Number,
        tax: Number,
        totalCharge: {
            type: Number,
            required: true
        },
        paidBy: {
            type: String,
            enum: ['sender', 'receiver'],
            default: 'sender'
        }
    },

    zone: {
        sourceZone: String,
        destinationZone: String,
        zoneType: String,
        estimatedDays: Number
    },


    issues: [{
        type: {
            type: String,
            enum: ['delay', 'damage', 'lost', 'wrong_address', 'customs_hold', 'weather', 'vehicle_breakdown', 'other']
        },
        severity: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical']
        },
        description: String,
        reportedAt: Date,
        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        resolvedAt: Date,
        resolution: String,
        images: [String]
    }],

    //Lables
    documents: {
        // Legacy public URL of a label PDF served from the container filesystem.
        shippingLabel: String,
        // Storage key, e.g. "labels/PRO2508201234567.pdf". Private - handed out
        // only as a short-lived signed URL by shippingService.generateShippingLabel.
        shippingLabelKey: String,
        invoiceUrl: String,
        customsDeclaration: String,
        packingList: String,
        deliveryReceipt: String
    },

}, {
    timestamps: true
});

// Generate unique tracking number
shippingSchema.pre('save', async function (next) {
    if (this.isNew && !this.trackingNumber) {
        const couriar = this.courierPartner.name.substring(0, 3).toUpperCase();
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        const count = await mongoose.model('Shipping').countDocuments({
            createdAt: {
                $gte: new Date(date.setHours(0, 0, 0, 0)),
                $lt: new Date(date.setHours(23, 59, 59, 999))
            }
        });

        this.trackingNumber = `${couriar}${year}${month}${day}${String(count + 1).padStart(6, '0')}`;
    }
    next();
});

shippingSchema.index({ order: 1 });
shippingSchema.index({ status: 1 });
shippingSchema.index({ 'courierPartner.name': 1 });
shippingSchema.index({ createdAt: -1 });
shippingSchema.index({ 'delivery.estimatedDate': 1 });
shippingSchema.index({ 'shippingAddress.postalCode': 1 });

module.exports = mongoose.model('Shipping', shippingSchema);