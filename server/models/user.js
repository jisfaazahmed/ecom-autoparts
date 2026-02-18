const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN', 'CUSTOMER'],
    default: 'CUSTOMER',
  },
  // STATUS: Controls if they can login
  status: {
    type: String,
    enum: ['ACTIVE', 'PENDING', 'REJECTED', 'SUSPENDED'],
    default: 'ACTIVE',
  },
  shopName: {
    type: String, // Only for Vendors
  },
  // Vendor/shop extra fields (for role ADMIN)
  phone: { type: String },
  businessRegistration: { type: String },
  shopDescription: { type: String },
  address: { type: String },
  logoUrl: { type: String },
  commissionRate: { type: Number, default: 10 },
  rejectionReason: { type: String },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// MIDDLEWARE: Force PENDING status for new Admins (Vendors)
userSchema.pre('save', function(next) {
  if (this.isModified('role') && this.role === 'ADMIN' && this.isNew) {
    this.status = 'PENDING';
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema);