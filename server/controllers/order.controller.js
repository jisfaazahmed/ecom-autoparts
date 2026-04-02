const order = require('../models/order.model');
const orderService = require('../services/order.service');
const OrderTimeLine = require('../models/timeline.model');
const Shipping = require('../models/shipping.model');
const OrderItem = require('../models/orderItem.model');

//new order
module.exports.createOrder = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id || null;
        const newOrder = await orderService.createOrder(userId, {
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
        const userId = req.user?.id || req.user?._id;
        const { order, timeline } = await orderService.getOrderDetails(req.params.id, userId);

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
        const userId = req.user?.id || req.user?._id;
        const query = { user: userId };
        if (status) query.overallStatus = status;

        const orders = await order.find(query)
            .populate('items.product', 'name images')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit * 1);

        const total = await order.countDocuments(query);


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
        const userId = req.user?.id || req.user?._id;

        const order = await orderService.cancelOrder(
            req.params.id,
            userId,
            reason,
            'customer'
        );

        res.status(200).json({
            message: 'Order cancelled successfully',
            data: order
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Update Payment Status (Pending → Paid lifecycle)
module.exports.updatePaymentStatus = async (req, res) => {
    try {
        const { paymentStatus, transactionId } = req.body;

        const order = await orderService.updatePaymentStatus(
            req.params.id,
            paymentStatus,
            transactionId
        );

        res.status(200).json({
            success: true,
            message: 'Payment status updated successfully',
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
        const vendorId = req.user?._id || req.user?.id;
        if (!vendorId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized access'
            });
        }

        const itemQuery = { vendor: vendorId };
        if (status) itemQuery.status = status;

        const itemIds = await OrderItem.find(itemQuery).distinct('_id');
        if (itemIds.length === 0) {
            return res.json({
                success: true,
                data: {
                    orders: [],
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: 0,
                        pages: 0
                    }
                }
            });
        }

        const query = { items: { $in: itemIds } };

        const orders = await order.find(query)
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .populate('user', 'name email phone')
            .populate({
                path: 'items',
                populate: { path: 'product', select: 'name images' }
            });

        const vendorOrders = orders.map(orderDoc => {
            const vendorItems = (orderDoc.items || []).filter(
                item => item.vendor && item.vendor.toString() === vendorId.toString()
            );
            return {
                ...orderDoc.toObject(),
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
                message: error.message || error
            }
        )
    }
}

//Track the order
module.exports.trackOrder = async (req, res) => {
    try {
        const { trackingNumber } = req.params;

        const shipment = await Shipping.findOne({ trackingNumber })
            .select('order trackingNumber');

        if (!shipment) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const trackedOrder = await order.findById(shipment.order)
            .populate('items.product')
            .select('orderNumber overallStatus items shippingAddress estimatedDeliveryDate');

        if (!trackedOrder) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const timeline = await OrderTimeLine.find({ order: trackedOrder._id })
            .sort({ createdAt: -1 })
            .select('event title description createdAt');

        const orderPayload = trackedOrder.toObject();
        orderPayload.trackingNumber = orderPayload.trackingNumber || shipment.trackingNumber;

        res.status(200).json({ order: orderPayload, timeline });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};