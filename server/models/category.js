const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
<<<<<<< HEAD
    type: String, // URL-friendly name (e.g., "brake-pads")
=======
    type: String,
>>>>>>> origin/feature/seller
    lowercase: true,
    unique: true,
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
<<<<<<< HEAD
    ref: 'Category', // Points to itself
    default: null,
  },
  image: {
    type: String, // URL to an icon (optional for now)
  }
=======
    ref: 'Category',
    default: null,
  },
  description: {
    type: String,
    default: null,
  },
  icon: {
    type: String,
    default: null,
  },
  image: {
    type: String,
    default: null,
  },
>>>>>>> origin/feature/seller
});

module.exports = mongoose.model('Category', categorySchema);