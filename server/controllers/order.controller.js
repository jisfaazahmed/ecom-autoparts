const order = require('../models/order.model');
const orderService = require('../services/order.service');
const OrderTimeLine = require('../models/timeline.model');
const Shipping = require('../models/shipping.model');
const OrderItem = require('../models/orderItem.model');

//new order
module.exports.createOrder = async (req, res) => {
    try {
        const paymentMethod = String(req.body?.paymentMethod || '').toLowerCase();
        if (paymentMethod === 'card' && !req.user) {
            return res.status(401).json({
                message: 'Authentication is required for card payment',
            });
        }

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
        const message = String(error?.message || 'Failed to place order');
        const isValidationError =
            message.includes('not assigned to a vendor') ||
            message.includes('does not own product') ||
            message.includes('unavailable for purchase') ||
            message.includes('Shipping address is incomplete') ||
            message.includes('No items provided for order') ||
            message.includes('Product not found') ||
            message.includes('stock not available');

        res.status(isValidationError ? 400 : 500).json({ message });
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
            .populate({
                path: 'items',
                populate: { path: 'product', select: 'name images price' }
            })
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
            req.user?._id || req.user?.id,
            note
        )

        const item = await OrderItem.findById(id).select('vendor');
        if (item?.vendor) {
            await orderService.syncSubOrderStatusByItem(req.params.id, item.vendor);
        }

        res.status(200).json(order);

    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Update Overall Order status by Admin
module.exports.adminUpdateOrderStatus = async (req, res) => {
    try {
        const { status, trackingNumber } = req.body;
        const userId = req.user?._id || req.user?.id;
        
        const order = await orderService.adminUpdateOrderStatus(
            req.params.id, 
            status, 
            userId, 
            trackingNumber
        );

        res.status(200).json(order);
    } catch (error) {
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
        const role = String(req.user?.role || '').toLowerCase().replace('_', '');
        if (!['admin', 'superadmin'].includes(role)) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required to update payment status'
            });
        }

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

        const { subOrders, pagination } = await orderService.getSellerSubOrders(vendorId, {
            status,
            page,
            limit,
        });

        const vendorOrders = subOrders.map((subOrderDoc) => {
            const subOrder = subOrderDoc.toObject();
            const parentOrder = subOrder.order;

            return {
                _id: parentOrder?._id,
                orderNumber: parentOrder?.orderNumber,
                user: subOrder.customer,
                items: subOrder.items,
                overallStatus: parentOrder?.overallStatus,
                paymentStatus: parentOrder?.paymentStatus,
                totalAmount: parentOrder?.totalAmount,
                createdAt: parentOrder?.createdAt || subOrder.createdAt,
                subOrder: {
                    _id: subOrder._id,
                    seller: subOrder.seller,
                    status: subOrder.status,
                    paymentStatus: subOrder.paymentStatus,
                    subtotal: subOrder.subtotal,
                    shippingCharge: subOrder.shippingCharge,
                    taxAmount: subOrder.taxAmount,
                    discountAmount: subOrder.discountAmount,
                    totalAmount: subOrder.totalAmount,
                    shippingMethod: subOrder.shippingMethod,
                    trackingNumber: subOrder.trackingNumber,
                    courierPartner: subOrder.courierPartner,
                    items: subOrder.items,
                }
            };
        });

        res.json({
            success: true,
            data: {
                orders: vendorOrders,
                pagination
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

// direct seller sub-order feed
module.exports.getMySubOrders = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        const sellerId = req.user?._id || req.user?.id;

        if (!sellerId) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized access'
            });
        }

        const result = await orderService.getSellerSubOrders(sellerId, {
            status,
            page,
            limit,
        });

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to fetch sub-orders'
        });
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
            .populate({
                path: 'items',
                populate: { path: 'product', select: 'name images price' }
            })
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