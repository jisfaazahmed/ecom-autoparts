const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  // 1. Basic Info
  name: { type: String, required: true, trim: true }, // e.g. "Bosch Ceramic Pads"
  description: { type: String },
  price: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
  sku: { type: String, required: true }, // Changed from partNumber to match frontend
  image: { type: String }, // URL to image
  productDiscountPercent: { type: Number, default: 0, min: 0, max: 90 },

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

  // 4. Who created this? (Vendor or Super Admin)
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // 5. Is it active? (Visibility controlled by creator)
  isActive: { type: Boolean, default: true },

  // 6. Admin Approval Status
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending"
  },

  // 7. Homepage featured flag (managed by Super Admin)
  featured: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

// Listing/search indexes
productSchema.index({ status: 1, isActive: 1, category: 1, createdAt: -1 });
productSchema.index({ status: 1, isActive: 1, createdBy: 1, createdAt: -1 });
productSchema.index({ compatibleVehicles: 1, status: 1, isActive: 1 });
productSchema.index({ featured: 1, status: 1, isActive: 1, updatedAt: -1, createdAt: -1 });

// Text index for product search (name/sku/description)
productSchema.index(
  { name: 'text', sku: 'text', description: 'text' },
  {
    weights: {
      name: 10,
      sku: 8,
      description: 3,
    },
    name: 'product_text_search_idx',
  }
);

module.exports = mongoose.model('Product', productSchema);