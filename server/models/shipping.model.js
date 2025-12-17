const mongoose = require('mongoose');

const ShippingSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  postalCode: { type: String, required: true },
  country: { type: String, required: true },
  shippingMethod: { type: String, required: true },
  trackingNumber: { type: String },
  status: { type: String, default: 'Pending', enum: ['Pending', 'Shipped', 'Delivered'] },
  shippedAt: {type: Date},
  deliveredAt: {type: Date},
  courier: {type: String},
  shippingCost: {type: Number}
}, { timestamps: true });

module.exports = mongoose.model('Shipping', ShippingSchema);