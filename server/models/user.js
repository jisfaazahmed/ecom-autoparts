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
  commissionRate: {
    type: Number,
    default: 10,
    min: 0,
    max: 100,
  },
  // Password reset fields
  resetToken: {
    type: String,
    default: null
  },
  resetTokenExpiry: {
    type: Date,
    default: null
  },
  wallet: {
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    otp: {
      code: {
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
      },
      lastSentAt: {
        type: Date,
        default: null,
      },
    },
  },
  notificationPreferences: {
    orderUpdates: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true }
    },
    promotions: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false }
    },
    security: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: true }
    }
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
  next();
});

module.exports = mongoose.model('User', userSchema);