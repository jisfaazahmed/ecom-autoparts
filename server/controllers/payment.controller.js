const payment = require('../models/payment.model');
const order = require('../models/order.model');
const stripe = require('../config/stripe');

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

module.exports.stripePayment = async (req, res) => {
    try {
        const { orderId , amount } = req.body; 
        const charge = await stripe.charges.create({
            amount,
            currrency: 'lkr',
            metadata : { orderId },
        });

        await payment.create({
            orderId,
            amount,
            stripeChargeId: charge.id,
            method: 'Stripe',
            status: 'Completed',
        });
        res.status(200).json({ clientSecret: charge.client_secret });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports.payamentConfirmation = async (req, res) => {
    const event = req.body;

    try {
        if (event.type === 'charge.succeeded') {
            const charge = event.data.object;
            const orderId = charge.metadata.orderId;

            await payment.findOneAndUpdate(
                {transactionId: charge.id },
                { status: 'Completed' }
            );

            await order.findByIdAndUpdate(orderId, { status: 'Paid' });
        }

        res.status(200).json({ received: true });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

