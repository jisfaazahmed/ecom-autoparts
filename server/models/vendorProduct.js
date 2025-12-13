const mongoose = require('mongoose');

const vendorProductSchema = new mongoose.Schema({
  // 1. Link to the Master Product (The "What")
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  
  // 2. Link to the Vendor (The "Who")
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // 3. The Offer Details
  price: { type: Number, required: true },
  stock: { type: Number, required: true, default: 0 },
  condition: { 
    type: String, 
    enum: ['New', 'Used', 'Refurbished'], 
    default: 'New' 
  },
  
  // 4. Is the offer active? (Vendor can hide it)
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Prevent a vendor from adding the same product twice
vendorProductSchema.index({ product: 1, vendor: 1 }, { unique: true });

module.exports = mongoose.model('VendorProduct', vendorProductSchema);