const mongoose = require('mongoose');

const userVehicleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleBrand',
      required: true,
    },
    model: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleModel',
      required: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleVariant',
      default: null,
    },

    year: {
      type: Number,
      required: true,
    },
    registrationNumber: {
      type: String,
      default: null,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

userVehicleSchema.index({ user: 1 });

module.exports = mongoose.model('UserVehicle', userVehicleSchema);
