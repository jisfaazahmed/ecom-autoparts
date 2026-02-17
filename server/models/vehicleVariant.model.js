const mongoose = require('mongoose');

const vehicleVariantSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Reference to VehicleModel
    model: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleModel',
      required: true,
    },
    yearStart: {
      type: Number,
      required: true,
    },
    yearEnd: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Helpful index for common queries
vehicleVariantSchema.index({ model: 1, name: 1, yearStart: 1 });

module.exports = mongoose.model('VehicleVariant', vehicleVariantSchema);

