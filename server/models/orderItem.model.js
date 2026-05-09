const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
<<<<<<< HEAD
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    },
    quantity: { 
        type: Number,
        required: true
    },
    price: { 
        type: Number,
        required: true
    }
=======
    product : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    vendor :{
        type : mongoose.Schema.Types.ObjectId,
        ref: 'User',
      required: false
    },
    name : String,
    image : String,
    quantity:{
        type : Number,
        required: true,
        min :1
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
    enum: ['pending', 'confirmed', 'accepted', 'processing', 'packed', 'ready_to_ship', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'return_requested', 'returned', 'refunded'],
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
>>>>>>> origin/feature/seller
});

module.exports = mongoose.model('OrderItem', orderItemSchema);