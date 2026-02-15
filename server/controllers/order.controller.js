const order = require('../models/order.model');
const orderService = require('../services/order.service');
const OrderTimeLine = require('../models/timeline.model');

//new order
module.exports.createOrder = async (req, res) => {
    try {
        const newOrder = await orderService.createOrder(req.user._id, {
            ...req.body,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.status(200).json({
            order: newOrder,
            message: 'order placed successfully',
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};

//Get order by ID
module.exports.getOrderById = async (req, res) => {
    try {
        const { order, timeline } = await orderService.getOrderDetails(req.params.id, req.user._id);

        if (!order) {
            return res.status(404).json({ message: 'Order Not found' });
        }

        res.status(200).json({ order, timeline });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};

//Get all order
module.exports.getAllOrders = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const query = { user: req.user._id };
        if (status) query.overallStatus = status;

        const orders = await order.find(query)
            .populate('items.product', 'name images')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit * 1);

        const total = await order.countDocuments();


        res.status(200).json({
            success: true,
            data: {
                orders,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message })
    }
}

// Update Order status
module.exports.updateOrderStatus = async (req, res) => {
    try {

        const { id, status, note } = req.body;

        const order = await orderService.updateItemStatus(
            req.params.id,
            id,
            status,
            req.user._id,
            note
        )

        res.status(200).json(order);

    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Cancel order
module.exports.cancelOrder = async (req, res) => {
    try {
        const { reason } = req.body;

        const order = await orderService.cancelOrder(
            req.params.id,
            req.user._id,
            reason,
            'customer'
        );

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status === 'Shipped' || order.status === 'Delivered') {
            return res.status(400).json({
                message: 'Cannot cancel order that has been shipped or delivered'
            });
        }

        order.status = 'Cancelled';
        await order.save();

        res.status(200).json({
            message: 'Order cancelled successfully',
            data: order
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports.verifyCOD = async (req, res) => {
    try {
        const { status, notes } = req.body;

        const order = await orderService.verifyCOD(
            req.params.id,
            req.user._id,
            status,
            notes
        );

        res.json({
            message: 'COD verification updated',
            data: order
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

//vendor order
module.exports.getVendorOrders = async (req, res) => {

    try {
        const { status, page = 1, limit = 10 } = req.query;

        const query = { 'items.vendor': req.user._id };
        if (status) query['items.status'] = status;

        const orders = await order.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('user', 'name email phone');

        // Filter items for this vendor only
        const vendorOrders = orders.map(order => {
            const vendorItems = order.items.filter(
                item => item.vendor.toString() === req.user._id.toString()
            );
            return {
                ...order.toObject(),
                items: vendorItems
            };
        });

        const total = await order.countDocuments(query);

        res.json({
            success: true,
            data: {
                orders: vendorOrders,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    }
    catch (error) {
        res.status(400).json(
            {
                success: false,
                message: error
            }
        )
    }
}

//Track the order
module.exports.trackOrder = async (req, res) => {
    try {
        const trackedOrder = await order.findOne({ trackingNumber: req.params.trackingNumber })
            .populate('items.product')
            .select('orderNumber overallStatus items shippingAddress estimatedDeliveryDate');
        if (!trackedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const timeline = await OrderTimeLine.find({ order: trackedOrder._id })
            .sort({ createdAt: -1 })
            .select('event title description createdAt');


        res.status(200).json({ order: trackedOrder, timeline });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};