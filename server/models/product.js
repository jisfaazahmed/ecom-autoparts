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

  // 3. Compatible VehicleVariants
  compatibleVehicleVariants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleVariant'
  }],

  // Legacy compatibility field still used by existing routes/controllers.
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

  ,// 6. Review summary (kept in sync by review controller)
  rating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 }
}, { timestamps: true });

// Index for fast searching by Category and Vehicle
productSchema.index({ category: 1, compatibleVehicles: 1 });
productSchema.index({ category: 1, compatibleVehicleVariants: 1 });

// Text index for search functionality (name, description, partNumber)
productSchema.index({ name: 'text', description: 'text', partNumber: 'text' });

// Index for price-based queries
productSchema.index({ price: 1 });

module.exports = mongoose.model('Product', productSchema);