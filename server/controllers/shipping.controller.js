const shipping = require('../models/shipping.model');
const order = require('../models/order.model');

module.exports.createShipping = async (req, res) => {
    try {
        const shippingCost = req.body.cost;
        const newShipping = await shipping.create({ ...req.body, cost: shippingCost });
        await order.findByIdAndUpdate(newShipping.orderId, { shippingId: newShipping._id });
        res.status(201).json(newShipping);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};