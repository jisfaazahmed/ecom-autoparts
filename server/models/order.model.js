const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    vendorProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorProduct',
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    quantity: { type: Number, required: true, default: 1 },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    buyerName: String,
    buyerEmail: String,
    items: [orderItemSchema],
    totalAmount: { type: Number, default: 0 },
    status: { type: String, default: 'Pending' },
    shippingAddress: String,
  },
  { timestamps: true }
);

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
