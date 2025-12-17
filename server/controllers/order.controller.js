const order = require('../models/order.model');

module.exports.createOrder = async (req, res) => {
    try {
        const newOrder = new order(req.body);
        await order.findByIdAndUpdate(newOrder._id, { status: 'Processing' });
        const savedOrder = await newOrder.save();
        res.status(201).json(savedOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports.trackOrder = async (req, res) => {
    try {
        const orderId = req.params.id;
        const foundOrder = await order.findById(orderId);
        if (!foundOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json(foundOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};