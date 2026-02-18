import mongoose from "mongoose";

const sellerSchema = new mongoose.Schema(
  {
    // Basic Info (required for authentication)
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // Shop Info
    shopName: { type: String },
    shopDescription: { type: String },
    shopLogo: { type: String },

    // Shop Settings
    shippingSettings: {
      flatRate: { type: Number, default: 0 },
      freeShippingMinAmount: { type: Number, default: 0 },
      shippingOrigin: { type: String }
    },

    returnPolicy: { type: String },
    vacationMode: { type: Boolean, default: false },
    vacationModeEnd: { type: Date },
    lowStockAlertThreshold: { type: Number, default: 10 },

    // Ratings
    rating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },

    // Financial Tracking
    walletBalance: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    commissionRate: { type: Number, default: 10 },

    // Seller Status
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const Seller = mongoose.model("Seller", sellerSchema);
export default Seller;
