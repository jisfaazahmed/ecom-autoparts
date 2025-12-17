const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  
  // ENUMS MUST MATCH EXACTLY WHAT THE CONTROLLER SENDS
  role: { 
    type: String, 
    default: 'USER', 
    enum: ['USER', 'ADMIN', 'SUPER_ADMIN'] // <--- Verify these are UPPERCASE
  },
  
  shopName: { type: String }, 
  
  status: { 
    type: String, 
    default: 'PENDING', 
    enum: ['PENDING', 'APPROVED', 'REJECTED'] // <--- Verify these are UPPERCASE
  }
}, { timestamps: true });

// Prevent "OverwriteModelError" while ensuring we use the NEW schema
if (mongoose.models.User) {
  delete mongoose.models.User;
}

module.exports = mongoose.model('User', UserSchema);