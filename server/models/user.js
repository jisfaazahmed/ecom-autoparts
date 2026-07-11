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
  phone: { type: String },
  address: { type: String },
  city: { type: String },
  postalCode: { type: String },
  avatarUrl: { type: String },

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
  // Email verification for signup/login (separate from wallet OTP)
  emailVerification: {
    codeHash: {
      type: String,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastSentAt: {
      type: Date,
      default: null,
    },
    sendCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    sendWindowStartAt: {
      type: Date,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  shopName: {
    type: String, // Only for Vendors
  },

  // Vendor/shop extra fields (for role ADMIN)
  businessRegistration: { type: String },
  shopDescription: { type: String },
  logoUrl: { type: String },
  commissionRate: { type: Number, default: 10 },
  rejectionReason: { type: String },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  resetToken: {
    type: String,
    default: null
  },
  resetTokenExpiry: {
    type: Date,
    default: null
  }

}, { timestamps: true });

// MIDDLEWARE: Force PENDING status for new Admins (Vendors)
userSchema.pre('save', function(next) {
  if (this.isModified('role') && this.role === 'ADMIN' && this.isNew) {
    this.status = 'PENDING';
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema);