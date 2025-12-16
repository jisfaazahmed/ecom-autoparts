const payment = require('../models/payment.model');
const order = require('../models/order.model');

module.exports.createPayment = async (req, res) => {
    try {
        const newPayment = new payment(req.body);   
        await order.findByIdAndUpdate(newPayment.orderId, { status: 'Paid' });
        const savedPayment = await newPayment.save();
        res.status(201).json(savedPayment);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }   
};

module.exports.getPaymentById = async (req, res) => {
    try {
        const paymentId = req.params.id;
        await order.findByIdAndUpdate(paymentId, { status: 'Paid' });
        const foundPayment = await payment.findById(paymentId);
        if (!foundPayment) {
            return res.status(404).json({ message: 'Payment not found' });
        }   
        res.status(200).json(foundPayment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

