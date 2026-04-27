const mongoose = require('mongoose');

const policySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      // e.g., "Return Policy", "Shipping Policy", "Cancellation Policy", "Terms & Conditions"
    },
    policyType: {
      type: String,
      enum: ['return', 'shipping', 'cancellation', 'terms_conditions', 'privacy', 'warranty'],
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true, // HTML content for rich formatting
    },
    sections: [
      {
        title: String,
        content: String,
        order: Number,
      }
    ],
    effectiveDate: {
      type: Date,
      default: Date.now,
    },
    lastModified: {
      type: Date,
      default: Date.now,
    },
    modifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    version: {
      type: Number,
      default: 1,
    },
    applicableCategories: [
      {
        type: String,
        // e.g., "electronics", "automotive", "all"
      }
    ],
    metadata: {
      returnDays: Number, // for return policy
      extendedForDefects: Number,
      restockingFeePercentage: Number,
      freeShippingThreshold: Number, // for shipping policy
      shippingChargePolicy: {
        type: String,
        enum: ['customer_pays', 'platform_pays', 'tiered'],
      },
      cancellationWindow: Number, // hours - for cancellation policy
      refundProcessingDays: Number,
    },
    faqItems: [
      {
        question: String,
        answer: String,
        category: String,
      }
    ],
    contactInfo: {
      email: String,
      phone: String,
      supportUrl: String,
    },
    displaySettings: {
      showInHeader: { type: Boolean, default: false },
      showInFooter: { type: Boolean, default: true },
      displayOrder: Number,
      richTextEditor: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

policySchema.index({ policyType: 1 });
policySchema.index({ isActive: 1 });

module.exports = mongoose.model('Policy', policySchema);
