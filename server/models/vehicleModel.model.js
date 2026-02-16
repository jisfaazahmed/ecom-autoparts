const mongoose = require('mongoose');

const vehicleModelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Reference to VehicleBrand
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleBrand',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate model names per brand
vehicleModelSchema.index({ brand: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('VehicleModel', vehicleModelSchema);

