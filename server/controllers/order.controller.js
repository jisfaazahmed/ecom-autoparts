const order = require('../models/order.model');

module.exports.createOrder = async (req, res) => {
    try {
        const newOrder = await order.create(req.body);
        res.status(201).json(newOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports.getOrderById = async (req, res) => {
    try {
        const foundOrder = await order.findById(req.params.id).populate('items');
        if (!foundOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json(foundOrder);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports.trackOrder = async (req, res) => {
    try {
        const trackedOrder = await order.findOne({ trackingNumber: req.params.trackingNumber }).populate('items');
        if (!trackedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(200).json(trackedOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};