const mongoose = require('mongoose');

const deliveryZoneSchema = new mongoose.Schema({

    zoneName: {
        type: String,
        required: true,
        unique: true
    },

    zoneCode: {
        type: String,
        required: true,
        unique: true
    },

    zoneType: {
        type: String,
        enum: ['zone1', 'zone2', 'zone3'],
        required: true
    },


    coverage: {
        cities: [String],
        districts: [String],
        provinces: [String],
        postalCodes: [String]
    },

    services: {
        standard: {
            available: { type: Boolean, default: true },
            estimatedDays: { type: Number, default: 5 }
        },
        express: {
            available: { type: Boolean, default: true },
            estimatedDays: { type: Number, default: 2 }
        },
        sameDay: {
            available: { type: Boolean, default: false },
            cutoffTime: String
        }
    },

    availableCouriers: [{
        courier: String,
        priority: Number,
        available: {
            type: Boolean,
            default: true
        }
    }],

    codAvailable: {
        type: Boolean,
        default: true
    },

    serviceAvailable: {
        type: Boolean,
        default: true
    },


}, {
    timestamps: true
});

deliveryZoneSchema.index({ 'coverage.postalCodes': 1 });
deliveryZoneSchema.index({ 'coverage.cities': 1 });

module.exports = mongoose.model('DeliveryZone', deliveryZoneSchema);