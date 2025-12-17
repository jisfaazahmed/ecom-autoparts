const Order = require('../models/order.model'); // Imported

// 1. Create Order (Now uses the 'Order' variable)
exports.createOrder = async (req, res) => {
  try {
    // 'Order' is now used here!
    const newOrder = new Order(req.body); 
    const savedOrder = await newOrder.save();
    
    res.status(201).json({ 
      message: "Order created successfully", 
      order: savedOrder 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Track Order (Uses 'Order' to find data)
exports.trackOrder = async (req, res) => {
  try {
    // 'Order' is used here too!
    const order = await Order.findById(req.params.id);
    
    if (!order) return res.status(404).json({ message: "Order not found" });
    
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};