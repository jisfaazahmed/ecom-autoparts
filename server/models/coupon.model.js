const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true,
  },
  description: {
    type: String,
    default: '',
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed', 'fixed_amount'],
    default: 'percentage',
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0,
  },
  minimumOrderAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  maxUses: {
    type: Number,
    default: null,
    min: 1,
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0,
  },
  validFrom: {
    type: Date,
    default: () => new Date(),
  },
  validUntil: {
    type: Date,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true });

couponSchema.index({ isActive: 1, validFrom: 1, validUntil: 1 });

module.exports = mongoose.model('Coupon', couponSchema);
