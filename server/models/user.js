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
  phone: {
    type: String,
    trim: true,
    default: null,
  },
  address: {
    type: String,
    trim: true,
    default: null,
  },
  city: {
    type: String,
    trim: true,
    default: null,
  },
  postalCode: {
    type: String,
    trim: true,
    default: null,
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
  rejectionReason: { type: String },
  avatarUrl: {
    type: String,
    default: null,
  },

  commissionRate: {
    type: Number,
    default: 10,
    min: 0,
    max: 100,
  },
  shopWideDiscountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 90,
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
  next();
});

module.exports = mongoose.model('User', userSchema);