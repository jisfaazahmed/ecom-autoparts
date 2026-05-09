<<<<<<< HEAD
const Order = require('../models/order.model'); // Imported

// 1. Create Order (Now uses the 'Order' variable)
exports.createOrder = async (req, res) => {
  try {
    // 'Order' is now used here!
    const newOrder = new Order(req.body); 
    const savedOrder = await newOrder.save();
    
    res.status(201).json({ 
      message: "Order created successfully", 
      order: savedOrder 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Track Order (Uses 'Order' to find data)
exports.trackOrder = async (req, res) => {
  try {
    // 'Order' is used here too!
    const order = await Order.findById(req.params.id);
    
    if (!order) return res.status(404).json({ message: "Order not found" });
    
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
=======
const order = require('../models/order.model');
const orderService = require('../services/order.service');
const OrderTimeLine = require('../models/timeline.model');
const Shipping = require('../models/shipping.model');
const OrderItem = require('../models/orderItem.model');
const jwt = require('jsonwebtoken');

const GUEST_INVOICE_TOKEN_EXPIRY = process.env.GUEST_INVOICE_TOKEN_EXPIRY || '7d';

function generateGuestInvoiceToken(orderId) {
    return jwt.sign(
        {
            purpose: 'guest_invoice',
            orderId: String(orderId),
        },
        process.env.JWT_SECRET || 'secret123',
        { expiresIn: GUEST_INVOICE_TOKEN_EXPIRY }
    );
}

function verifyGuestInvoiceToken(token, orderId) {
    if (!token) return false;
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
        return payload?.purpose === 'guest_invoice' && String(payload?.orderId) === String(orderId);
    } catch (_err) {
        return false;
    }
}

//new order
module.exports.createOrder = async (req, res) => {
    try {
        const paymentMethod = String(req.body?.paymentMethod || '').toLowerCase();
        if ((paymentMethod === 'card' || paymentMethod === 'wallet') && !req.user) {
            return res.status(401).json({
                message: `Authentication is required for ${paymentMethod} payment`,
            });
        }

        const userId = req.user?.id || req.user?._id || null;
        const newOrder = await orderService.createOrder(userId, {
            ...req.body,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        const payload = {
            order: newOrder,
            message: 'order placed successfully',
        };

        // For guest checkouts, return a signed short-lived token for invoice download.
        if (!userId) {
            payload.guestInvoiceToken = generateGuestInvoiceToken(newOrder._id);
        }

        res.status(200).json(payload);
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
            message.includes('stock not available') ||
            message.includes('coupon') ||
            message.includes('Coupon') ||
            message.includes('Minimum order amount');

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
                shippingAddress: parentOrder?.shippingAddress,
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

// Recover guest orders when a user registers with the same email they used for checkout
module.exports.recoverGuestOrders = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        const userEmail = req.user?.email;
        
        if (!userId || !userEmail) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Find orders with no user but matching email in shippingAddress
        const guestOrders = await order.find({
            $or: [
                { user: null },
                { user: { $exists: false } }
            ],
            'shippingAddress.fullName': { $regex: userEmail, $options: 'i' },
            createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
        }).limit(50);

        if (guestOrders.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No guest orders found for recovery',
                orders: []
            });
        }

        // Associate guest orders to the new user
        const result = await order.updateMany(
            {
                _id: { $in: guestOrders.map(o => o._id) },
                $or: [
                    { user: null },
                    { user: { $exists: false } }
                ]
            },
            { $set: { user: userId } }
        );

        res.status(200).json({
            success: true,
            message: `Recovered ${result.modifiedCount} guest order(s)`,
            orders: guestOrders
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message || 'Failed to recover guest orders'
        });
    }
};

// Generate or return invoice PDF for an order
module.exports.getInvoice = async (req, res) => {
    try {
        const invoiceService = require('../services/invoice.service');
        const orderId = req.params.id;

        const ord = await order.findById(orderId).select('user');
        if (!ord) return res.status(404).json({ message: 'Order not found' });

        const userId = req.user?.id || req.user?._id;
        const role = String(req.user?.role || '').toLowerCase();
        const isAdmin = ['admin', 'superadmin'].includes(role);

        // Authenticated customer endpoint should never expose guest orders.
        if (!ord.user && !isAdmin) {
            return res.status(403).json({ message: 'Guest order invoice requires guest invoice token' });
        }

        if (ord.user && String(ord.user) !== String(userId) && !isAdmin) {
            return res.status(403).json({ message: 'Unauthorized to download invoice' });
        }

        const { filePath, fileName } = await invoiceService.generateInvoicePdf(orderId);

        return res.download(filePath, fileName);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Public endpoint for guest checkout invoices using signed token
module.exports.getGuestInvoice = async (req, res) => {
    try {
        const invoiceService = require('../services/invoice.service');
        const orderId = req.params.id;
        const token = req.query?.token || req.header('x-guest-invoice-token');

        const ord = await order.findById(orderId).select('user');
        if (!ord) return res.status(404).json({ message: 'Order not found' });

        if (ord.user) {
            return res.status(400).json({ message: 'This order belongs to an account. Please login to download invoice.' });
        }

        if (!verifyGuestInvoiceToken(token, orderId)) {
            return res.status(401).json({ message: 'Invalid or expired guest invoice token' });
        }

        const { filePath, fileName } = await invoiceService.generateInvoicePdf(orderId);
        return res.download(filePath, fileName);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
>>>>>>> origin/feature/seller
};