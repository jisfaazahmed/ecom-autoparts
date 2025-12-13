const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String, // URL-friendly name (e.g., "brake-pads")
    lowercase: true,
    unique: true,
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category', // Points to itself
    default: null,
  },
  image: {
    type: String, // URL to an icon (optional for now)
  }
});

module.exports = mongoose.model('Category', categorySchema);