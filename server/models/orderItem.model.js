const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
    product : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        require: true
    },
    vendor :{
        type : mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name : String,
    image : String,
    quantity:{
        type : Number,
        required: true,
        nim :1
    },
    price:{
        type: Number,
        required:true 
    },
    discount: {
    type: Number,
    default: 0
  },
  finalPrice: Number,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'return_requested', 'returned', 'refunded'],
    default: 'pending'
  },
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  cancellationReason: String,
  returnReason: String,
  trackingNumber: String,
  estimatedDelivery: Date,
  actualDelivery: Date
});

module.exports = mongoose.model('OrderItem', orderItemSchema);