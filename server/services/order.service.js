const Order = require('../models/order.model');
const OrderItem = require('../models/orderItem.model');
const Product = require('../models/product');
const OrderTimeLine = require('../models/timeline.model')
const Cart = require('../models/Cart');

class OrderService {

    // Create Order
    async createOrder(userId, orderData) {
        try {
            const { shippingAddress, shippingCity, shippingPostalCode, fullName, phone, shippingCountry = 'Sri Lanka', paymentMethod = 'cod', deliveryInstructions, couponCode, items = [] } = orderData;

            const normalizedShippingAddress = typeof shippingAddress === 'string'
                ? {
                    fullName: fullName || 'Guest Customer',
                    phone: phone || 'N/A',
                    addressLine1: shippingAddress,
                    city: shippingCity || '',
                    postalCode: shippingPostalCode || '',
                    country: shippingCountry || 'Sri Lanka'
                }
                : shippingAddress;

            if (!normalizedShippingAddress?.addressLine1 || !normalizedShippingAddress?.city || !normalizedShippingAddress?.postalCode) {
                throw new Error('Shipping address is incomplete');
            }

            if (!items || !Array.isArray(items) || items.length === 0) {
                throw new Error('No items provided for order');
            }

            // Load products and check stock
            const enrichedItems = [];
            for (const item of items) {
                const product = await Product.findById(item.productId || item.product);
                if (!product) {
                    throw new Error('Product not found');
                }
                if (product.stock < item.quantity) {
                    throw new Error(`${product.name} stock not available`);
                }
                enrichedItems.push({ product, quantity: item.quantity });
            }

            const itemTotal = enrichedItems.reduce((sum, { product, quantity }) => sum + (product.price * quantity), 0);
            const shippingCharge = this.calculateShipping(enrichedItems.map(({ product, quantity }) => ({ product, quantity })), { city: normalizedShippingAddress.city || '' });
            const texAmount = this.calculateTax(itemTotal);
            const discountAmount = couponCode ? await this.applyCoupon(couponCode, itemTotal) : 0;
            const totalAmount = itemTotal + shippingCharge + texAmount - discountAmount;

            const orderItemDocs = await OrderItem.create(
                enrichedItems.map(({ product, quantity }) => {
                    const vendor = product.vendor || product.createdBy || product.shopId || product.owner || product.seller;
                    return {
                        product: product._id,
                        vendor: vendor || undefined,
                        name: product.name,
                        image: product.images?.[0] || '',
                        quantity,
                        price: product.price,
                        discount: product.discount || 0,
                        finalPrice: product.price * quantity,
                        status: 'pending',
                        statusHistory: [{
                            status: 'pending',
                            timestamp: new Date(),
                            note: 'Order placed'
                        }]
                    };
                })
            );

            const order = new Order({
                user: userId,
                items: orderItemDocs.map(item => item._id),
                shippingAddress: normalizedShippingAddress,
                itemsTotal: itemTotal,
                shippingCharges: shippingCharge,
                taxAmount: texAmount,
                discountAmount,
                couponDiscount: discountAmount,
                totalAmount,
                paymentMethod,
                paymentStatus: paymentMethod === 'cod' ? 'pending' : 'processing',
                overallStatus: 'pending',
                deliveryInstructions,
                estimatedDeliveryDate: this.calculateEstimateDelivery(orderData.shippingMethod || 'standard'),
                shippingMethod: orderData.shippingMethod || 'standard',
                ipAddress: orderData.ipAddress,
                userAgent: orderData.userAgent
            });

            await order.save();

            //stock update
            for (const { product, quantity } of enrichedItems) {
                await Product.findByIdAndUpdate(
                    product._id,
                    { $inc: { stock: -quantity, soldCount: quantity } }
                );
            }

            // status timeline
            await OrderTimeLine.create([{
                order: order._id,
                event: 'order_placed',
                title: 'Order Placed',
                description: `Order ${order.orderNumber} has been placed successfully`,
                actor: userId || null,
                actorType: userId ? 'customer' : 'guest',
                metadata: { totalAmount, itemCount: orderItemDocs.length }
            }]);

            //Notification
            this.sendOrderNotification(order, 'order Placed');

            return order;
        }
        catch (error) {
            throw error;
        }
    }

    //multi venodr
    groupItemsByVendor(items) {
        const grouped = {};
        items.forEach(item => {
            const vendorId = item.product.vendor || item.product.createBy;
            if (!grouped[vendorId]) {
                grouped[vendorId] = [];
            }
            grouped[vendorId].push(item);
        });
        return grouped;
    }

    //calculate shipping

    getZoneMultiplier(city) {
        if (!city) return 0;

        const normalizedCity = city.toString().trim().toLowerCase();
        const zone1 = ['colombo'];
        const zone2 = ['gampaha', 'kaluthara'];
        const zone3 = [
            'kurunegala',
            'kandy',
            'matale',
            'nuwara eliya',
            'galle',
            'matara',
            'hambantota',
            'puttalam',
            'anuradhapura',
            'polonnaruwa',
            'badulla',
            'monaragala',
            'ratnapura',
            'kegalle',
            'trincomalee',
            'batticaloa',
            'ampara',
            'jaffna',
            'vavuniya',
            'mannar',
            'kilinochchi',
            'mullaitivu'
        ];

        if (zone1.includes(normalizedCity)) return 100;
        if (zone2.includes(normalizedCity)) return 200;
        if (zone3.includes(normalizedCity)) return 300;
        return 0;
    }


    calculateShipping(items, address) {
        const totalWeight = items.reduce((sum, item) => {
            return sum + (item.product.weight || 0.5) * item.quantity;
        }, 0);

        const baserate = 300;
        const weightRate = totalWeight * 50;
        const zoneMultiplier = this.getZoneMultiplier(address.city);
        const handlefee = 300;

        const shipping = baserate + weightRate + zoneMultiplier + handlefee;
        return Number.isFinite(shipping) ? Math.round(shipping) : 0;
    }

    calculateTax(amount) {
        return Math.round(amount * 0.18);
    }

    calculateEstimateDelivery(shippingMethod) {
        const days = {
            'same_day': 0,
            'express': 2,
            'standard': 5,
            'pickup_piont': 7
        };

        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + (days[shippingMethod] || 5));
        return deliveryDate;
    }

    async updateItemStatus(orderId, itemId, status, userId, note) {
        const order = await Order.findById(orderId).populate('items');
        if (!order) {
            throw new Error('Order not found');
        }

        const item = await OrderItem.findById(itemId);
        if (!item) {
            throw new Error('Order item not found');
        }

        if (!order.items.some(i => i._id.toString() === itemId.toString())) {
            throw new Error('Order item does not belong to this order');
        }

        if (!this.isValidStatusTransition(item.status, status)) {
            throw new Error(`Invalid status transition from ${item.status} to ${status}`);
        }

        item.status = status;
        item.statusHistory.push({
            status,
            timestamp: new Date(),
            note,
            updatedBy: userId
        });

        await item.save();

        // Recalculate overall order status
        const allItems = await OrderItem.find({ _id: { $in: order.items } });
        order.overallStatus = this.calculateOverallStatus(allItems);
        await order.save();

        // timeline create
        await OrderTimeLine.create({
            order: orderId,
            orderItem: itemId,
            event: this.mapStatusToEvent(status),
            title: this.getStatusTitle(status),
            description: note || `Item status updated to ${status}`,
            actor: userId,
            actorType: 'vendor'
        });

        this.sendOrderNotifications(order, this.mapStatusToEvent(status));
        return order;
    }

    // All validate status
    isValidStatusTransition(currentStatus, newStatus) {
        const validTransitions = {
            'pending': ['confirmed', 'cancelled'],
            'confirmed': ['processing', 'cancelled'],
            'processing': ['ready_to_ship', 'cancelled'],
            'ready_to_ship': ['shipped'],
            'shipped': ['out_for_delivery', 'delivered', 'return_requested'],
            'out_for_delivery': ['delivered', 'return_requested'],
            'delivered': ['return_requested'],
            'return_requested': ['returned', 'cancelled'],
            'returned': ['refunded']
        };

        return validTransitions[currentStatus]?.includes(newStatus) || false;
    }

    //Calculate overall order status
    mapStatusToEvent(status) {
        const mapping = {
            'confirmed': 'order_confirmed',
            'processing': 'processing_started',
            'ready_to_ship': 'ready_to_ship',
            'shipped': 'shipped',
            'out_for_delivery': 'out_for_delivery',
            'delivered': 'delivered',
            'cancelled': 'cancelled_by_vendor',
            'return_requested': 'return_requested',
            'returned': 'return_received',
            'refunded': 'refund_completed'
        };
        return mapping[status] || status;
    }

    getStatusTitle(status) {
        const titles = {
            'confirmed': 'Order Confirmed',
            'processing': 'Processing Started',
            'ready_to_ship': 'Ready to Ship',
            'shipped': 'Order Shipped',
            'out_for_delivery': 'Out for Delivery',
            'delivered': 'Order Delivered',
            'cancelled': 'Order Cancelled',
            'return_requested': 'Return Requested',
            'returned': 'Return Received',
            'refunded': 'Refund Completed'
        };
        return titles[status] || status;
    }

    calculateOverallStatus(items) {
        const statuses = items.map(item => item.status);

        if (statuses.every(s => s === 'delivered')) return 'delivered';
        if (statuses.every(s => s === 'cancelled')) return 'cancelled';
        if (statuses.some(s => s === 'delivered') && statuses.some(s => s !== 'delivered')) {
            return 'partially_delivered';
        }
        if (statuses.some(s => s === 'shipped') && statuses.some(s => s !== 'shipped')) {
            return 'partially_shipped';
        }
        if (statuses.every(s => s === 'confirmed')) return 'confirmed';
        if (statuses.some(s => s === 'processing' || s === 'ready_to_ship')) return 'processing';

        return 'pending';
    }

    // Update payment status (for lifecycle: Pending → Paid → Processing)
    async updatePaymentStatus(orderId, paymentStatus, transactionId = null) {
        const order = await Order.findById(orderId);
        
        if (!order) {
            throw new Error('Order not found');
        }

        const validPaymentStatuses = ['pending', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'];
        if (!validPaymentStatuses.includes(paymentStatus)) {
            throw new Error('Invalid payment status');
        }

        order.paymentStatus = paymentStatus;
        if (transactionId) {
            order.transactionId = transactionId;
        }

        // Auto-update order status when payment is completed
        if (paymentStatus === 'completed') {
            order.paidAmount = order.totalAmount;
            
            // Update all order items to confirmed
            const orderItems = await OrderItem.find({ _id: { $in: order.items } });
            for (const item of orderItems) {
                if (item.status === 'pending') {
                    item.status = 'confirmed';
                    item.statusHistory.push({
                        status: 'confirmed',
                        timestamp: new Date(),
                        note: 'Payment received, order confirmed'
                    });
                    await item.save();
                }
            }

            order.overallStatus = 'confirmed';

            await OrderTimeLine.create({
                order: orderId,
                event: 'payment_completed',
                title: 'Payment Completed',
                description: `Payment of ${order.totalAmount} received successfully`,
                actorType: 'system',
                metadata: { amount: order.totalAmount, transactionId }
            });
        }

        await order.save();
        return order;
    }

    //COD verification
    async initiateCODVerification(orderId) {
        const order = await Order.findById(orderId).populate('user');

        order.initiateCODVerification.push({
            attemptedAt: new Date(),
            status: 'pending'
        });

        await order.save();
        return order;
    }

    //attempts
    async verfyCOD(orderId, verifiedBy, status, notes) {
        const order = await Order.findById(orderId);

        const lastAttempt = order.codVerificationAttempts[order.codVerificationAttempts.length - 1];
        lastAttempt.verifiedBy = verifiedBy;
        lastAttempt.status = status;
        lastAttempt.notes = notes;

        if (status === 'success') {
            order.codeVerified = true;
            order.overallStatus = 'confirmed';

            await OrderTimeLine.create({
                order: orderId,
                event: 'cod_verified',
                title: 'COD Verified',
                description: 'Cash on Delivery order has been verified',
                actor: verifiedBy,
                actorType: 'admin'
            });
        }
        else if (order.codVerificationAttempts.length >= 3) {
            order.overallStatus = 'cancelled';
            order.cancellationRequest = {
                requestedBy: verifiedBy,
                requestedAt: new Date(),
                reason: 'COD verification failed after multiple attempts',
                status: 'approved'
            };
        }

        await order.save();
        return order;
    }

    // Cancelling
    async cancelOrder(orderId, userId, reason, cancelledBy = 'customer') {
        const session = await Order.startSession();
        session.startTransaction();

        try {
            const order = await Order.findById(orderId).session(session);

            if (!order) {
                throw new Error('order noy found');
            }

            const nonCancellableStatuses = ['shipped', 'out_for_delivary', 'delivery', 'cancelled'];
            if (nonCancellableStatuses.includes(order.overallStatus)) {
                throw new Error(`Order cannot be cancelled in ${order.overallStatus} status`);
            }

            //update order
            order.overallStatus = 'cancelled';
            order.cancellationRequest = {
                requestedBy: userId,
                requestedAt: new Date(),
                reason,
                status: 'approved',
                approvedBy: userId,
                approvedAt: new Date()
            };

            // Cancel all order items
            const orderItems = await OrderItem.find({ _id: { $in: order.items } }).session(session);
            
            for (const item of orderItems) {
                item.status = 'cancelled';
                item.cancellationReason = reason;
                item.statusHistory.push({
                    status: 'cancelled',
                    timestamp: new Date(),
                    note: reason,
                    updatedBy: userId
                });
                await item.save({ session });
            }

            await order.save({ session });

            //restore stock
            for (const item of orderItems) {
                await Product.findByIdAndUpdate(
                    item.product,
                    { $inc: { stock: item.quantity, soldCount: -item.quantity } },
                    { session }
                );
            }

            // Create timeline event
            await OrderTimeLine.create([{
                order: orderId,
                event: cancelledBy === 'customer' ? 'cancelled_by_customer' : 'cancelled_by_vendor',
                title: 'Order Cancelled',
                description: reason,
                actor: userId,
                actorType: cancelledBy
            }], { session });

            await session.commitTransaction();

            if (order.paymentStatus === 'completed') {
                this.processRefund(orderId, order.totalAmount, 'order_cancelled');

            }

            return order;
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }

    // refund
    async processRefund(orderId, amount, reason) {
        const order = await Order.findById(orderId);

        order.paymentStatus = 'refunded';
        await order.save();

        await OrderTimeLine.create({
            order: orderId,
            event: 'refund_initiated',
            title: 'Refund Initiated',
            description: `Refund of ₹${amount} initiated. Reason: ${reason}`,
            actorType: 'system',
            metadata: { amount, reason }
        });

        return order;
    }

    //get order detail
    async getOrderDetails(orderId, userId) {
        const order = await Order.findById(orderId)
            .populate('user', 'name email')
            .populate('items.product')
            .populate('items.vendor', 'name email storeName');

        if (!order) {
            throw new Error('ordernot found');
        }

        const user = await Order.findById(userId);
        const isVendor = order.items.some(item => item.vendor._id.toString() === userId);
        const isCustomer = order.user._id.toString() === userId;
        const isAdmin = user.role === 'admin';

        if (!isCustomer && !isVendor && !isAdmin) {
            throw new Error('Unauthorized access');
        }

        const timeline = await OrderTimeLine.find({ order: orderId })
            .sort({ createdAt: -1 })
            .populate('actor', 'name');

        return { order, timeline };
    }
}

module.exports = new OrderService();