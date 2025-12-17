const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // 1. Basic Info
  name: { type: String, required: true, trim: true }, // e.g. "Bosch Ceramic Pads"
  description: { type: String },
  price: { type: Number, required: true },
  stock: { type: Number, required: true, min: 0 },
  partNumber: { type: String, required: true }, // e.g. "BC-1234"
  image: { type: String }, // URL to image

  // 2. The Link to "Brakes > Pads"
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },

  // 3. The Link to "Tesla > Model S" (The Fitment Engine)
  // This array lists EVERY car ID this part fits.
  compatibleVehicles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  }],

  // 4. Who created this? (Super Admin)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // 5. Is it active?
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Index for fast searching by Category and Vehicle
productSchema.index({ category: 1, compatibleVehicles: 1 });

module.exports = mongoose.model('Product', productSchema);