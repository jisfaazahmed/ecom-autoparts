const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // ROLES: Must match what Auth Controller sends
  role: { 
    type: String, 
    default: 'USER', 
    enum: ['USER', 'ADMIN', 'SUPER_ADMIN'] 
  },
  
  shopName: { type: String }, 
  
  // Saved vehicles for "My Garage"
  savedVehicles: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  }],
  
  // Wishlist - saved products
  wishlist: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  
  // STATUS: Must match what Auth Controller sends
  status: { 
    type: String, 
    default: 'PENDING', 
    enum: ['PENDING', 'APPROVED', 'REJECTED'] 
  }
}, { timestamps: true });

// Check if model exists before creating to prevent "Overwrite" errors
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);