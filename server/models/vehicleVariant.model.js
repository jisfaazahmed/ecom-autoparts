const mongoose = require('mongoose');

const vehicleVariantSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    model: { type: mongoose.Schema.Types.ObjectId, ref: 'VehicleModel', required: true },
    yearStart: { type: Number, required: true, min: 1886 },
    yearEnd: { type: Number, min: 1886 },
    engine: { type: String, trim: true },
  },
  { timestamps: true }
);

vehicleVariantSchema.index({ model: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('VehicleVariant', vehicleVariantSchema);