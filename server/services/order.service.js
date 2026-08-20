const Order = require('../models/order.model');
const OrderItem = require('../models/orderItem.model');
const SubOrder = require('../models/subOrder.model');
const Product = require('../models/product');
const VendorProduct = require('../models/vendorProduct');
const Coupon = require('../models/coupon.model');
const User = require('../models/user');
const OrderTimeLine = require('../models/timeline.model');
const NotificationService = require('./notification.service');
const InventoryReservationService = require('./inventoryReservation.service');
const shippingService = require('./shipping.service');

class OrderService {

    static ALLOWED_PAYMENT_METHODS = new Set(['cod', 'card', 'wallet']);

    static ALLOWED_SHIPPING_METHODS = new Set(['standard', 'express', 'same_day', 'pickup_point']);

    async calculateShippingForOrder(items, address, shippingMethod = 'standard') {
        try {
            const quote = await shippingService.calculateShippingCost({
                items: items.map((item) => ({
                    product: {
                        price: Number(item?.product?.price || 0),
                        weight: Number(item?.product?.weight || 0.5),
                    },
                    quantity: Number(item?.quantity || 0),
                })),
                deliveryAddress: {
                    district: String(address?.city || '').trim(),
                    city: String(address?.city || '').trim(),
                },
                shippingMethod,
            });

            return Number.isFinite(quote?.totalCharge) ? Math.round(quote.totalCharge) : 0;
        } catch (error) {
            console.warn('Shipping service quote failed, using fallback calculation:', error.message);
            return this.calculateShipping(items, address || {});
        }
    }

    normalizeStatus(status) {
        const value = String(status || '').toLowerCase();
        const aliases = {
            accepted: 'confirmed',
            packed: 'processing',
            readytoship: 'ready_to_ship',
            ready_to_ship: 'ready_to_ship',
            out_for_delivery: 'out_for_delivery',
        };
        return aliases[value] || value;
    }

    normalizeTextField(value, fieldName, { min = 1, max = 255, allowEmpty = false } = {}) {
        if (value === undefined || value === null) {
            if (allowEmpty) return '';
            throw new Error(`${fieldName} is required`);
        }

        if (typeof value !== 'string') {
            throw new Error(`${fieldName} must be a string`);
        }

        const normalized = value.trim().replace(/\s+/g, ' ');
        if (!normalized) {
            if (allowEmpty) return '';
            throw new Error(`${fieldName} is required`);
        }

        if (normalized.length < min || normalized.length > max) {
            throw new Error(`${fieldName} length must be between ${min} and ${max}`);
        }

        return normalized;
    }

    normalizeOptionalTextField(value, fieldName, { max = 255 } = {}) {
        if (value === undefined || value === null || value === '') {
            return '';
        }

        return this.normalizeTextField(value, fieldName, { min: 1, max, allowEmpty: true });
    }

    normalizePhone(value) {
        const normalized = this.normalizeTextField(value, 'Phone', { min: 7, max: 20 });
        const compact = normalized.replace(/[\s()-]/g, '');
        if (!/^\+?[0-9]{7,15}$/.test(compact)) {
            throw new Error('Phone must contain only digits and optional leading +');
        }
        return normalized;
    }

    normalizeItems(items) {
        if (!Array.isArray(items) || items.length === 0) {
            throw new Error('No items provided for order');
        }

        if (items.length > 50) {
            throw new Error('Order cannot contain more than 50 items');
        }

        const seen = new Set();

        return items.map((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                throw new Error(`Item at index ${index} must be an object`);
            }

            const rawProductId = String(item.productId || item.product || '').trim();
            if (!/^[a-fA-F0-9]{24}$/.test(rawProductId)) {
                throw new Error(`Item at index ${index} has invalid product id`);
            }

            if (seen.has(rawProductId)) {
                throw new Error(`Duplicate product in items: ${rawProductId}`);
            }
            seen.add(rawProductId);

            const parsedQuantity = Number(item.quantity);
            if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 999) {
                throw new Error(`Item at index ${index} has invalid quantity`);
            }

            const normalizedItem = {
                ...item,
                productId: rawProductId,
                quantity: parsedQuantity,
            };

            if (item.vendorId !== undefined || item.vendor !== undefined) {
                const vendorId = String(item.vendorId || item.vendor || '').trim();
                if (vendorId && !/^[a-fA-F0-9]{24}$/.test(vendorId)) {
                    throw new Error(`Item at index ${index} has invalid vendor id`);
                }
                normalizedItem.vendorId = vendorId || undefined;
                normalizedItem.vendor = vendorId || undefined;
            }

            return normalizedItem;
        });
    }

    normalizeAndValidateCreateOrderInput(orderData) {
        if (!orderData || typeof orderData !== 'object' || Array.isArray(orderData)) {
            throw new Error('Invalid order payload');
        }

        const paymentMethod = this.normalizeTextField(orderData.paymentMethod || 'cod', 'Payment method', {
            min: 3,
            max: 20,
        }).toLowerCase();

        if (!OrderService.ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
            throw new Error('Invalid payment method');
        }

        const shippingMethod = this.normalizeTextField(orderData.shippingMethod || 'standard', 'Shipping method', {
            min: 3,
            max: 30,
        }).toLowerCase();

        if (!OrderService.ALLOWED_SHIPPING_METHODS.has(shippingMethod)) {
            throw new Error('Invalid shipping method');
        }

        const shippingCountry = this.normalizeTextField(orderData.shippingCountry || 'Sri Lanka', 'Shipping country', {
            min: 2,
            max: 80,
        });

        const fullName = this.normalizeTextField(orderData.fullName || 'Guest Customer', 'Full name', {
            min: 2,
            max: 120,
        });
        const phone = this.normalizePhone(orderData.phone || '0000000');

        let normalizedShippingAddress;
        if (typeof orderData.shippingAddress === 'string') {
            normalizedShippingAddress = {
                fullName,
                phone,
                addressLine1: this.normalizeTextField(orderData.shippingAddress, 'Shipping address', { min: 5, max: 220 }),
                city: this.normalizeTextField(orderData.shippingCity, 'Shipping city', { min: 2, max: 100 }),
                postalCode: this.normalizeTextField(orderData.shippingPostalCode, 'Shipping postal code', { min: 3, max: 20 }),
                country: shippingCountry,
            };
        } else if (orderData.shippingAddress && typeof orderData.shippingAddress === 'object' && !Array.isArray(orderData.shippingAddress)) {
            normalizedShippingAddress = {
                fullName: this.normalizeTextField(orderData.shippingAddress.fullName || fullName, 'Full name', { min: 2, max: 120 }),
                phone: this.normalizePhone(orderData.shippingAddress.phone || phone),
                addressLine1: this.normalizeTextField(orderData.shippingAddress.addressLine1, 'Shipping address', { min: 5, max: 220 }),
                city: this.normalizeTextField(orderData.shippingAddress.city, 'Shipping city', { min: 2, max: 100 }),
                postalCode: this.normalizeTextField(orderData.shippingAddress.postalCode, 'Shipping postal code', { min: 3, max: 20 }),
                country: this.normalizeTextField(orderData.shippingAddress.country || shippingCountry, 'Shipping country', { min: 2, max: 80 }),
            };
        } else {
            throw new Error('Shipping address is incomplete');
        }

        const deliveryInstructions = this.normalizeOptionalTextField(orderData.deliveryInstructions, 'Delivery instructions', {
            max: 500,
        });
        const couponCode = this.normalizeOptionalTextField(orderData.couponCode, 'Coupon code', { max: 64 });
        const shopId = orderData.shopId === undefined || orderData.shopId === null || orderData.shopId === ''
            ? null
            : String(orderData.shopId).trim();

        if (shopId && !/^[a-fA-F0-9]{24}$/.test(shopId)) {
            throw new Error('Invalid shop id');
        }

        return {
            ...orderData,
            paymentMethod,
            shippingMethod,
            shippingCountry,
            fullName,
            phone,
            shippingAddress: normalizedShippingAddress,
            shippingCity: normalizedShippingAddress.city,
            shippingPostalCode: normalizedShippingAddress.postalCode,
            deliveryInstructions,
            couponCode,
            shopId,
            items: this.normalizeItems(orderData.items),
        };
    }

    buildSubOrders(orderItemDocs, enrichedItems, commissionRateByVendor = new Map()) {
        const grouped = new Map();

        orderItemDocs.forEach((itemDoc, index) => {
            const source = enrichedItems[index];
            const vendorId = String(
                itemDoc.vendor ||
                source?.product?.vendor ||
                source?.product?.createdBy ||
                source?.product?.shopId ||
                source?.product?.owner ||
                source?.product?.seller ||
                ''
            ).trim();

            if (!vendorId) {
                return;
            }

            if (!grouped.has(vendorId)) {
                grouped.set(vendorId, { vendor: vendorId, items: [], status: 'pending', subtotal: 0 });
            }

            const group = grouped.get(vendorId);
            group.items.push(itemDoc._id);
            group.subtotal += itemDoc.finalPrice || 0;
        });

        return Array.from(grouped.values()).map(group => ({
            commissionRate: Number(commissionRateByVendor.get(String(group.vendor)) || 0),
            commissionAmount: Number(((group.subtotal * Number(commissionRateByVendor.get(String(group.vendor)) || 0)) / 100).toFixed(2)),
            vendor: group.vendor,
            items: group.items,
            status: group.status,
            subtotal: group.subtotal,
            updatedAt: new Date()
        }));
    }

    buildSubOrderPayload(mainOrder, groupedSubOrder, financials = {}) {
        const subtotal = Number(groupedSubOrder.subtotal || 0);
        const orderSubtotal = Number(mainOrder.itemsTotal || 0);
        const ratio = orderSubtotal > 0 ? subtotal / orderSubtotal : 0;

        const shippingCharge = Number.isFinite(financials.shippingCharge)
            ? Number(financials.shippingCharge)
            : Math.round(Number(mainOrder.shippingCharges || 0) * ratio);
        const taxAmount = Number.isFinite(financials.taxAmount)
            ? Number(financials.taxAmount)
            : Math.round(Number(mainOrder.taxAmount || 0) * ratio);
        const discountAmount = Number.isFinite(financials.discountAmount)
            ? Number(financials.discountAmount)
            : Math.round(Number(mainOrder.discountAmount || 0) * ratio);

        return {
            order: mainOrder._id,
            seller: groupedSubOrder.vendor,
            customer: mainOrder.user || null,
            items: groupedSubOrder.items,
            status: groupedSubOrder.status || 'pending',
            paymentStatus: mainOrder.paymentStatus || 'pending',
            subtotal,
            shippingCharge,
            taxAmount,
            discountAmount,
            commissionRate: Number(groupedSubOrder.commissionRate || 0),
            commissionAmount: Number(groupedSubOrder.commissionAmount || 0),
            totalAmount: subtotal + shippingCharge + taxAmount - discountAmount,
            shippingAddress: mainOrder.shippingAddress,
            shippingMethod: mainOrder.shippingMethod || 'standard',
            estimatedDeliveryDate: mainOrder.estimatedDeliveryDate,
            courierPartner: groupedSubOrder.courierPartner || mainOrder.courierPartner,
            trackingNumber: groupedSubOrder.trackingNumber,
        };
    }

    async persistSubOrders(mainOrder, groupedSubOrders = []) {
        if (!Array.isArray(groupedSubOrders) || groupedSubOrders.length === 0) {
            return [];
        }

        const orderSubtotal = Number(mainOrder.itemsTotal || 0);
        let remainingShipping = Math.round(Number(mainOrder.shippingCharges || 0));
        let remainingTax = Math.round(Number(mainOrder.taxAmount || 0));
        let remainingDiscount = Math.round(Number(mainOrder.discountAmount || 0));

        const payloads = groupedSubOrders.map((groupedSubOrder, index) => {
            const isLast = index === groupedSubOrders.length - 1;
            const subtotal = Number(groupedSubOrder.subtotal || 0);
            const ratio = orderSubtotal > 0 ? subtotal / orderSubtotal : 0;

            const allocatedShipping = isLast
                ? remainingShipping
                : Math.round(Number(mainOrder.shippingCharges || 0) * ratio);
            const allocatedTax = isLast
                ? remainingTax
                : Math.round(Number(mainOrder.taxAmount || 0) * ratio);
            const allocatedDiscount = isLast
                ? remainingDiscount
                : Math.round(Number(mainOrder.discountAmount || 0) * ratio);

            remainingShipping -= allocatedShipping;
            remainingTax -= allocatedTax;
            remainingDiscount -= allocatedDiscount;

            return this.buildSubOrderPayload(mainOrder, groupedSubOrder, {
                shippingCharge: allocatedShipping,
                taxAmount: allocatedTax,
                discountAmount: allocatedDiscount,
            });
        });

        const operations = groupedSubOrders.map((groupedSubOrder, index) => ({
            updateOne: {
                filter: {
                    order: mainOrder._id,
                    seller: groupedSubOrder.vendor,
                },
                update: {
                    $set: payloads[index],
                },
                upsert: true,
            }
        }));

        await SubOrder.bulkWrite(operations);
        return SubOrder.find({ order: mainOrder._id });
    }

    async resolveVendorForOrderItem(product, item = {}) {
        const ownerVendor = String(
            product.createdBy ||
            product.vendor ||
            product.createdby ||
            product.shopId ||
            product.owner ||
            product.seller ||
            ''
        ).trim();

        if (!ownerVendor) {
            return null;
        }

        if (!/^[a-fA-F0-9]{24}$/.test(ownerVendor)) {
            return null;
        }

        const selectedVendor = String(
            item.vendorId ||
            item.vendor ||
            ''
        ).trim();

        // Customer must buy from the product owner only.
        if (selectedVendor && selectedVendor !== ownerVendor) {
            throw new Error(`Selected seller does not own product ${product.name}`);
        }

        // Prefer explicit owner offer if present, but do not block checkout when owner offers
        // table hasn't been backfilled yet.
        const ownerOffer = await VendorProduct.findOne({
            product: product._id,
            vendor: ownerVendor,
            isActive: true,
        }).select('_id');

        if (ownerOffer) {
            return ownerVendor;
        }

        return ownerVendor;
    }

    // Create Order
    async createOrder(userId, orderData) {
            const normalizedInput = this.normalizeAndValidateCreateOrderInput(orderData);
            const {
                paymentMethod,
                deliveryInstructions,
                couponCode,
                items,
                idempotency = null,
                shippingMethod,
                shippingAddress: normalizedShippingAddress,
                shopId,
            } = normalizedInput;

            // Load products, resolve vendor ownership, and check stock with inventory service
            const enrichedItems = [];
            for (const item of items) {
                const product = await Product.findById(item.productId || item.product);
                if (!product) {
                    throw new Error('Product not found');
                }

                if (!product.isActive || String(product.status || '') !== 'Approved') {
                    throw new Error(`${product.name} is currently unavailable for purchase`);
                }

                // Check available stock using user-aware inventory reservation service
                const availableStock = userId
                    ? await InventoryReservationService.getAvailableStockForUser(product._id, userId)
                    : await InventoryReservationService.getAvailableStock(product._id);
                if (availableStock < item.quantity) {
                    throw new Error(`${product.name} stock not available. Available: ${availableStock}, Requested: ${item.quantity}`);
                }

                const resolvedVendorId = await this.resolveVendorForOrderItem(product, item);
                if (!resolvedVendorId) {
                    throw new Error(`Product ${product.name} is not assigned to a vendor. Please choose a seller before checkout.`);
                }

                enrichedItems.push({ product, quantity: item.quantity, resolvedVendorId });
            }

            const itemTotal = enrichedItems.reduce((sum, { product, quantity }) => sum + (product.price * quantity), 0);
            const shippingItems = enrichedItems.map(({ product, quantity }) => ({ product, quantity }));
            const shippingCharge = await this.calculateShippingForOrder(
                shippingItems,
                { city: normalizedShippingAddress.city || '' },
                shippingMethod
            );
            const taxAmount = this.calculateTax(itemTotal);
            const couponResult = couponCode
                ? await this.applyCoupon(couponCode, itemTotal, shopId)
                : { discountAmount: 0, coupon: null };
            const discountAmount = couponResult.discountAmount;
            const totalAmount = itemTotal + shippingCharge + taxAmount - discountAmount;

            const orderItemDocs = await OrderItem.create(
                enrichedItems.map(({ product, quantity, resolvedVendorId }) => ({
                    product: product._id,
                    vendor: resolvedVendorId,
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
                }))
            );

            const vendorIds = [...new Set(enrichedItems.map((item) => String(item.resolvedVendorId || '')).filter(Boolean))];
            const vendorDocs = await User.find({ _id: { $in: vendorIds } }).select('_id commissionRate');
            const commissionRateByVendor = new Map(
                vendorDocs.map((vendor) => [String(vendor._id), Number(vendor.commissionRate || 0)])
            );
            const subOrders = this.buildSubOrders(orderItemDocs, enrichedItems, commissionRateByVendor);
            const commissionAmount = Number(
                subOrders.reduce((sum, subOrder) => sum + Number(subOrder.commissionAmount || 0), 0).toFixed(2)
            );

            const order = new Order({
                user: userId,
                items: orderItemDocs.map(item => item._id),
                subOrders,
                shippingAddress: normalizedShippingAddress,
                itemsTotal: itemTotal,
                shippingCharges: shippingCharge,
                taxAmount: taxAmount,
                discountAmount,
                commissionAmount,
                couponDiscount: discountAmount,
                couponCode: couponResult?.coupon?.code || null,
                couponId: couponResult?.coupon?._id || null,
                totalAmount,
                paymentMethod,
                paymentStatus: paymentMethod === 'cod' ? 'pending' : 'processing',
                overallStatus: 'pending',
                deliveryInstructions,
                estimatedDeliveryDate: this.calculateEstimateDelivery(shippingMethod),
                shippingMethod,
                ipAddress: normalizedInput.ipAddress,
                userAgent: normalizedInput.userAgent,
                ...(idempotency ? { idempotency } : {})
            });

            await order.save();

            await this.persistSubOrders(order, subOrders);

            // Convert cart reservations to order allocations and deduct stock
            for (let index = 0; index < enrichedItems.length; index += 1) {
                const { product, quantity } = enrichedItems[index];
                const orderItem = orderItemDocs[index];

                if (userId) {
                    try {
                        await InventoryReservationService.convertUserReservationToOrder({
                            userId,
                            productId: product._id,
                            quantity,
                            orderId: order._id,
                            orderItemId: orderItem?._id,
                        });
                    } catch (error) {
                        console.warn(`Warning: Could not convert reservation for ${product.name}:`, error.message);
                    }
                }

                await InventoryReservationService.acquireStockForOrder(
                    product._id,
                    quantity
                );

                if (userId) {
                    await InventoryReservationService.releaseUserProductReservation(
                        userId,
                        product._id,
                        'cancelled_by_user'
                    );
                }
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

            // Send notification
            await this.sendOrderNotification(order, 'order_placed');

            return order;
        
    
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
            'pickup_point': 7
        };

        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + (days[shippingMethod] || 5));
        return deliveryDate;
    }

    async adminUpdateOrderStatus(orderId, status, userId, trackingNumber) {
        const order = await Order.findById(orderId).populate('items');
        if (!order) {
            throw new Error('Order not found');
        }

        const normalizedStatus = this.normalizeStatus(status);

        for (const item of order.items) {
            item.status = normalizedStatus;
            item.statusHistory.push({
                status: normalizedStatus,
                timestamp: new Date(),
                note: `Admin updated order status to ${normalizedStatus}`,
                updatedBy: userId
            });
            if (trackingNumber && normalizedStatus === 'shipped') {
                item.trackingNumber = trackingNumber;
            }
            await item.save();

            await OrderTimeLine.create({
                order: orderId,
                orderItem: item._id,
                event: this.mapStatusToEvent(normalizedStatus),
                title: this.getStatusTitle(normalizedStatus),
                description: `Admin updated order status to ${normalizedStatus}`,
                actor: userId,
                actorType: 'admin'
            });
        }

        const allItems = await OrderItem.find({ _id: { $in: order.items } });
        order.overallStatus = this.calculateOverallStatus(allItems);

        if (order.subOrders) {
            order.subOrders = order.subOrders.map(subOrder => {
                const sub = subOrder.toObject ? subOrder.toObject() : subOrder;
                return {
                    ...sub,
                    status: normalizedStatus,
                    trackingNumber: trackingNumber || sub.trackingNumber,
                    updatedAt: new Date()
                };
            });
        }

        await order.save();
        return order;
    }

    async updateItemStatus(orderId, itemId, status, userId, note) {
        const order = await Order.findById(orderId).populate('items');
        if (!order) {
            throw new Error('Order not found');
        }

        const normalizedStatus = this.normalizeStatus(status);

        const item = await OrderItem.findById(itemId);
        if (!item) {
            throw new Error('Order item not found');
        }

        if (!order.items.some(i => i._id.toString() === itemId.toString())) {
            throw new Error('Order item does not belong to this order');
        }

        if (String(item.vendor || '') !== String(userId || '')) {
            throw new Error('Unauthorized: you can only update your own order items');
        }

        if (!this.isValidStatusTransition(item.status, normalizedStatus)) {
            throw new Error(`Invalid status transition from ${item.status} to ${normalizedStatus}`);
        }

        item.status = normalizedStatus;
        item.statusHistory.push({
            status: normalizedStatus,
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
            event: this.mapStatusToEvent(normalizedStatus),
            title: this.getStatusTitle(normalizedStatus),
            description: note || `Item status updated to ${normalizedStatus}`,
            actor: userId,
            actorType: 'vendor'
        });

        const itemVendorId = String(item.vendor || '');
        order.subOrders = (order.subOrders || []).map(subOrder => {
            const sub = subOrder.toObject ? subOrder.toObject() : subOrder;
            if (String(sub.vendor) !== itemVendorId) return sub;
            const subOrderItems = order.items.filter(orderItem => sub.items.some(subItem => String(subItem) === String(orderItem._id)));
            const nextStatus = this.calculateOverallStatus(subOrderItems);
            return {
                ...sub,
                status: nextStatus,
                updatedAt: new Date()
            };
        });

        await order.save();

        this.sendOrderNotifications(order, this.mapStatusToEvent(normalizedStatus));
        return order;
    }

    // All validate status
    isValidStatusTransition(currentStatus, newStatus) {
        const normalizedCurrent = this.normalizeStatus(currentStatus);
        const normalizedNew = this.normalizeStatus(newStatus);
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

        return validTransitions[normalizedCurrent]?.includes(normalizedNew) || false;
    }

    //Calculate overall order status
    mapStatusToEvent(status) {
        const normalized = this.normalizeStatus(status);
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
        return mapping[normalized] || normalized;
    }

    getStatusTitle(status) {
        const normalized = this.normalizeStatus(status);
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
        return titles[normalized] || normalized;
    }

    calculateOverallStatus(items) {
        const statuses = items.map(item => this.normalizeStatus(item.status));

        if (statuses.every(s => s === 'delivered')) return 'delivered';
        if (statuses.every(s => s === 'cancelled')) return 'cancelled';
        if (statuses.every(s => s === 'refunded')) return 'refunded';
        if (statuses.some(s => s === 'delivered') && statuses.some(s => s !== 'delivered')) {
            return 'partially_delivered';
        }
        if (statuses.some(s => s === 'shipped') && statuses.some(s => s !== 'shipped')) {
            return 'partially_shipped';
        }
        if (statuses.every(s => s === 'confirmed')) return 'confirmed';
        if (statuses.every(s => s === 'processing')) return 'processing';
        if (statuses.every(s => s === 'ready_to_ship')) return 'ready_to_ship';
        if (statuses.every(s => s === 'shipped')) return 'shipped';
        if (statuses.every(s => s === 'out_for_delivery')) return 'out_for_delivery';
        if (statuses.every(s => s === 'return_requested')) return 'return_requested';
        if (statuses.every(s => s === 'returned')) return 'returned';
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

        // Payment completion should only mark the order as paid.
        // Vendor approval still controls item/sub-order confirmation.
        if (paymentStatus === 'completed') {
            order.paidAmount = order.totalAmount;

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
        await SubOrder.updateMany(
            { order: order._id },
            { $set: { paymentStatus: order.paymentStatus } }
        );
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
    async verifyCOD(orderId, verifiedBy, status, notes) {
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
    // Customer confirms the parcel actually arrived. This is deliberately separate
    // from the vendor/courier marking it delivered: it is the customer's own word,
    // and it is what pins down actualDeliveryDate for the return window.
    async confirmOrderReceipt(orderId, userId, note = null) {
        const order = await Order.findById(orderId).populate('items');

        if (!order) {
            throw new Error('Order not found');
        }

        if (!userId || !order.user || String(order.user) !== String(userId)) {
            throw new Error('Unauthorized access to order');
        }

        order.deliveryConfirmation = order.deliveryConfirmation || {};

        // Idempotent: a second tap returns the existing confirmation rather than
        // rewriting the timestamp the return window is measured from.
        if (order.deliveryConfirmation.confirmed) {
            return order;
        }

        const currentStatus = this.normalizeStatus(order.overallStatus || order.status);
        const confirmable = ['out_for_delivery', 'delivered', 'partially_delivered'];

        if (!confirmable.includes(currentStatus)) {
            throw new Error('This order cannot be confirmed as received yet');
        }

        const confirmedAt = new Date();

        order.deliveryConfirmation = {
            confirmed: true,
            confirmedAt,
            confirmedBy: userId,
            note: note ? String(note).trim().slice(0, 500) : null,
        };

        // The customer has the goods, so treat this as the authoritative delivery
        // moment when the courier never recorded one.
        if (!order.actualDeliveryDate) {
            order.actualDeliveryDate = confirmedAt;
        }

        // Customer received it while still marked out for delivery — settle the
        // status rather than leaving it stranded mid-transit.
        const wasInTransit = currentStatus === 'out_for_delivery';
        if (wasInTransit) {
            const itemIds = (order.items || []).map((item) => item._id || item);
            await OrderItem.updateMany(
                { _id: { $in: itemIds }, status: { $nin: ['cancelled', 'returned', 'refunded'] } },
                { $set: { status: 'delivered' } }
            );

            const refreshedItems = await OrderItem.find({ _id: { $in: itemIds } });
            order.overallStatus = this.calculateOverallStatus(refreshedItems);
        }

        await order.save();

        await OrderTimeLine.create({
            order: order._id,
            event: 'delivery_confirmed',
            title: 'Delivery Confirmed by Customer',
            description: note
                ? `Customer confirmed receipt: ${String(note).trim().slice(0, 200)}`
                : 'Customer confirmed they received this order',
            actor: userId,
            actorType: 'customer',
            metadata: { confirmedAt, promotedFromOutForDelivery: wasInTransit },
        });

        // Let the vendors know the customer acknowledged receipt.
        try {
            const vendorIds = [...new Set(
                (order.items || [])
                    .map((item) => item.vendor && String(item.vendor))
                    .filter(Boolean)
            )];

            await Promise.all(
                vendorIds.map((vendorId) => NotificationService.notifyVendorOrderDelivered(order, vendorId))
            );
        } catch (error) {
            console.error('Failed to notify vendors of delivery confirmation:', error);
        }

        return order;
    }

    async cancelOrder(orderId, userId, reason, cancelledBy = 'customer') {
        const runCancellation = async (session = null) => {
            const orderQuery = Order.findById(orderId);
            if (session) orderQuery.session(session);
            const order = await orderQuery;

            if (!order) {
                throw new Error('order noy found');
            }

            const nonCancellableStatuses = ['shipped', 'out_for_delivary', 'delivery', 'cancelled'];
            if (nonCancellableStatuses.includes(order.overallStatus)) {
                throw new Error(`Order cannot be cancelled in ${order.overallStatus} status`);
            }

            order.overallStatus = 'cancelled';
            order.cancellationRequest = {
                requestedBy: userId,
                requestedAt: new Date(),
                reason,
                status: 'approved',
                approvedBy: userId,
                approvedAt: new Date()
            };

            const orderItemsQuery = OrderItem.find({ _id: { $in: order.items } });
            if (session) orderItemsQuery.session(session);
            const orderItems = await orderItemsQuery;

            for (const item of orderItems) {
                item.status = 'cancelled';
                item.cancellationReason = reason;
                item.statusHistory.push({
                    status: 'cancelled',
                    timestamp: new Date(),
                    note: reason,
                    updatedBy: userId
                });
                await item.save(session ? { session } : undefined);
            }

            await order.save(session ? { session } : undefined);

            await SubOrder.updateMany(
                { order: order._id },
                {
                    $set: {
                        status: 'cancelled',
                        paymentStatus: order.paymentStatus,
                        actualDeliveryDate: null,
                        notes: reason
                    }
                }
            );

            for (const item of orderItems) {
                await Product.findByIdAndUpdate(
                    item.product,
                    { $inc: { stock: item.quantity, soldCount: -item.quantity } },
                    session ? { session } : undefined
                );
            }

            await OrderTimeLine.create([{
                order: orderId,
                event: cancelledBy === 'customer' ? 'cancelled_by_customer' : 'cancelled_by_vendor',
                title: 'Order Cancelled',
                description: reason,
                actor: userId,
                actorType: cancelledBy
            }], session ? { session } : undefined);

            if (order.paymentStatus === 'completed') {
                await this.processRefund(orderId, order.totalAmount, 'order_cancelled');
            }

            return order;
        };

        let session;
        try {
            session = await Order.startSession();
            session.startTransaction();
            const order = await runCancellation(session);
            await session.commitTransaction();
            return order;
        } catch (error) {
            if (session?.inTransaction()) {
                await session.abortTransaction();
            }

            const transactionUnsupported = String(error?.message || '').includes('Transaction numbers are only allowed on a replica set member or mongos');
            if (transactionUnsupported) {
                return runCancellation(null);
            }

            throw error;
        } finally {
            session?.endSession();
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
            .populate({
                path: 'items',
                populate: [
                    { path: 'product' },
                    { path: 'vendor', select: 'name email storeName role' }
                ]
            });

        if (!order) {
            throw new Error('ordernot found');
        }

        const user = await User.findById(userId).select('role');
        if (!user) {
            throw new Error('Unauthorized access');
        }

        const isVendor = (order.items || []).some(item => String(item?.vendor?._id || item?.vendor) === String(userId));
        const isCustomer = String(order?.user?._id || order?.user) === String(userId);
        const isAdmin = ['admin', 'superadmin'].includes(String(user.role || '').toLowerCase());

        if (!isCustomer && !isVendor && !isAdmin) {
            throw new Error('Unauthorized access');
        }

        const timeline = await OrderTimeLine.find({ order: orderId })
            .sort({ createdAt: -1 })
            .populate('actor', 'name');

        return { order, timeline };
    }

    async getSellerSubOrders(sellerId, { status, page = 1, limit = 10 } = {}) {
        const query = { seller: sellerId };
        if (status) {
            query.status = this.normalizeStatus(status);
        }

        const safePage = Math.max(parseInt(page, 10) || 1, 1);
        const safeLimit = Math.max(parseInt(limit, 10) || 10, 1);

        const [subOrders, total] = await Promise.all([
            SubOrder.find(query)
                .sort({ createdAt: -1 })
                .skip((safePage - 1) * safeLimit)
                .limit(safeLimit)
                .populate('customer', 'name email phone')
                .populate('order', 'orderNumber overallStatus paymentStatus createdAt totalAmount shippingAddress')
                .populate({
                    path: 'items',
                    populate: { path: 'product', select: 'name images price' }
                }),
            SubOrder.countDocuments(query)
        ]);

        return {
            subOrders,
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                pages: Math.ceil(total / safeLimit)
            }
        };
    }

    async syncSubOrderStatusByItem(orderId, vendorId) {
        const subOrder = await SubOrder.findOne({ order: orderId, seller: vendorId }).populate('items');
        if (!subOrder) return null;

        const nextStatus = this.calculateOverallStatus(subOrder.items || []);
        subOrder.status = nextStatus;
        await subOrder.save();
        return subOrder;
    }

    // Notification methods
    async sendOrderNotification(order, event) {
        try {
            if (!order.user) return;

            if (event === 'order_placed' || event === 'order Placed') {
                await NotificationService.notifyOrderCreated(order);
                if (order.couponCode) {
                    await NotificationService.notifySuperAdminCouponUsed(order);
                }
            } else if (event === 'order_confirmed') {
                await NotificationService.notifyOrderConfirmed(order);
            } else if (event === 'order_shipped' || event === 'shipped') {
                await NotificationService.notifyOrderShipped(order, order.trackingNumber, order.courierPartner);
            } else if (event === 'order_delivered' || event === 'delivered') {
                await NotificationService.notifyOrderDelivered(order);
            } else if (event === 'processing_started' || event === 'processing') {
                await NotificationService.notifyOrderProcessing(order);
            } else if (event === 'out_for_delivery') {
                await NotificationService.notifyOrderOutForDelivery(order);
            } else if (event === 'payment_failed') {
                await NotificationService.notifyPaymentFailed(order);
            } else if (event === 'payment_success') {
                await NotificationService.notifyPaymentSuccess(order, order.totalAmount);
            }

            console.log(`✓ Order notification sent: ${event} for order ${order.orderNumber}`);
        } catch (error) {
            console.error(`✗ Error sending notification: ${event}`, error);
        }
    }

    async sendOrderNotifications(order, event) {
        try {
            await this.sendOrderNotification(order, event);
        } catch (error) {
            console.error(`✗ Error sending order notifications: ${event}`, error);
        }
    }

    // Coupon methods
    async applyCoupon(couponCode, itemTotal, shopId) {
        const normalizedCode = String(couponCode || '').trim().toUpperCase();
        if (!normalizedCode) {
            return { discountAmount: 0, coupon: null };
        }

        const now = new Date();
        const query = {
            code: normalizedCode,
            isActive: true,
            validFrom: { $lte: now },
            $or: [
                { validUntil: null },
                { validUntil: { $gte: now } }
            ],
        };

        if (shopId) {
            query.$and = [{
                $or: [
                    { shopId: null },
                    { shopId }
                ]
            }];
        }

        let coupon = await Coupon.findOne(query);
        if (!coupon) {
            throw new Error('Invalid or expired coupon code');
        }

        if (coupon.minimumOrderAmount && Number(itemTotal) < Number(coupon.minimumOrderAmount)) {
            throw new Error(`Minimum order amount is ${coupon.minimumOrderAmount}`);
        }

        if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
            throw new Error('Coupon usage limit reached');
        }

        if (coupon.maxUses) {
            const reserved = await Coupon.findOneAndUpdate(
                {
                    _id: coupon._id,
                    usedCount: { $lt: coupon.maxUses },
                    isActive: true,
                },
                { $inc: { usedCount: 1 } },
                { new: true }
            );

            if (!reserved) {
                throw new Error('Coupon usage limit reached');
            }

            coupon = reserved;
        } else {
            coupon.usedCount = Number(coupon.usedCount || 0) + 1;
            await coupon.save();
        }

        const type = String(coupon.discountType || '').toLowerCase();
        const value = Number(coupon.discountValue || 0);

        let discountAmount = 0;
        if (type === 'percentage') {
            discountAmount = Math.round((Number(itemTotal) * value) / 100);
        } else {
            discountAmount = Math.round(value);
        }

        discountAmount = Math.max(0, Math.min(Number(itemTotal), discountAmount));

        return { discountAmount, coupon };
    }
}

module.exports = new OrderService();