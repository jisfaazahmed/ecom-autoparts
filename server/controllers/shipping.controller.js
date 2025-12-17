const shipping = require('../models/shipping.model');
const order = require('../models/order.model');

module.exports.createShipping = async (req, res) => {
    try {
        const shippingCost = req.body.shippingCost || 0;
        const newShipping = new shipping({ ...req.body, shippingCost });
        await order.findByIdAndUpdate(newShipping.orderId, { status: 'Shipped' });
        const savedShipping = await newShipping.save();
        res.status(201).json(savedShipping);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }   
};
