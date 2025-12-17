const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  year: { type: Number, required: true, index: true },
  make: { type: String, required: true, trim: true, index: true },
  model: { type: String, required: true, trim: true, index: true },
  submodel: { type: String, trim: true }, // e.g., "LE", "XLE"
  engine: { type: String, trim: true },   // e.g., "V6 3.5L"
  
  // This helps search: "2022 Toyota Camry LE"
  searchString: { type: String, lowercase: true }
});

// Auto-generate the search string before saving
vehicleSchema.pre('save', function(next) {
  this.searchString = `${this.year} ${this.make} ${this.model} ${this.submodel || ''} ${this.engine || ''}`.toLowerCase();
  next();
});

// Prevent duplicates (You don't want two identical 2022 Camrys)
vehicleSchema.index({ year: 1, make: 1, model: 1, submodel: 1, engine: 1 }, { unique: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);