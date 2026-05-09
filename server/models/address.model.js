const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fullName: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    addressLine1: {
        type: String,
        required: true
    },
    addressLine2: {
        type: String
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    postalCode: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true,
        default: 'Sri Lanka'
    },
    isDefaultShipping: {
        type: Boolean,
        default: false
    },
    isDefaultBilling: {
        type: Boolean,
        default: false
    },
    addressType: {
        type: String,
        enum: ['home', 'office', 'other'],
        default: 'home'
    }
}, { timestamps: true });

// Ensure only one default shipping and billing address per user
addressSchema.pre('save', async function(next) {
    if (this.isDefaultShipping) {
        await this.constructor.updateMany(
            { user: this.user, _id: { $ne: this._id } },
            { isDefaultShipping: false }
        );
    }
    if (this.isDefaultBilling) {
        await this.constructor.updateMany(
            { user: this.user, _id: { $ne: this._id } },
            { isDefaultBilling: false }
        );
    }
    next();
});

module.exports = mongoose.model('Address', addressSchema);
