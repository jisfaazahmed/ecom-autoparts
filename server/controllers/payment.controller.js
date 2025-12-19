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

module.exports.processStripePayment = async (req, res) => {
    try {
        const { orderId, amount} = req.body;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount ,
            currency: 'lkr',
            metadata: { orderId }
        });

        await payment.create({
            orderId,
            amount,
            paymentMethod: 'Stripe',
            status: 'Completed',
            transactionId: paymentIntent.id
        });

        res.status(200).json({ clientSecret: paymentIntent.client_secret });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports.paymentConfirmation = async (req, res) => {
    const event = req.body;

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        
        await payment.findOneAndUpdate(
            { transactionId: paymentIntent.id },
            { status: 'Completed' }
        );

        await order.findByIdAndUpdate(
            paymentIntent.metadata.orderId,
            { status: 'Paid' }
        );
    }   

    res.status(200).json({ received: true });
};