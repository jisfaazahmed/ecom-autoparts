const Refund = require('../models/refund.model');
const Order = require('../models/order.model');
const OrderItem = require('../models/orderItem.model');
const Payment = require('../models/payment.model');
const OrderTimeline = require('../models/timeline.model');
const paymentService = require('./payment.service');
const NotificationService = require('./notification.service');
const InventoryReservationService = require('./inventoryReservation.service');
const { randomInt } = require('crypto');

class RefundService {

    async generateRequestNumber() {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const suffix = `${Date.now().toString().slice(-6)}${String(randomInt(100, 1000))}`;
        return `RFN${year}${month}${day}${suffix}`;
    }

    isRequestNumberDuplicate(error) {
        return Boolean(
            error &&
            error.code === 11000 &&
            error.keyPattern &&
            error.keyPattern.requestNumber
        );
    }

    async saveRefundWithUniqueRequestNumber(refundDoc, maxRetries = 5) {
        let retries = 0;
        while (retries <= maxRetries) {
            try {
                if (!refundDoc.requestNumber) {
                    refundDoc.requestNumber = await this.generateRequestNumber();
                }

                await refundDoc.save();
                return refundDoc;
            } catch (error) {
                if (this.isRequestNumberDuplicate(error) && retries < maxRetries) {
                    retries += 1;
                    refundDoc.requestNumber = await this.generateRequestNumber();
                    continue;
                }
                throw error;
            }
        }

        throw new Error('Could not generate a unique refund request number');
    }

    async createRefundRequest(orderItemId, refundData, userId) {
        return this.creaetRefundRequest(refundData, userId, orderItemId);
    }

    async creaetRefundRequest(refundData, userId, orderItemId) {
        
            if (!userId) {
                throw new Error('Customer authentication is required');
            }

            const order = await Order.findOne({
                items: orderItemId,
                user: userId
            });

            if (!order) {
                throw new Error('Order not found or unauthorized');
            }

            const orderItem = await OrderItem.findById(orderItemId).populate('product');
            if (!orderItem) {
                throw new Error('Order Item not found');
            }

            if (orderItem.status !== 'delivered') {
                throw new Error('Can only request refund for delivered items');
            }

            const existingItemRefund = await Refund.findOne({
                customer: userId,
                order: order._id,
                orderItem: orderItemId,
                status: { $nin: ['rejected', 'cancelled'] }
            }).sort({ createdAt: -1 });

            if (existingItemRefund) {
                throw new Error(`A refund request already exists for this order item (${existingItemRefund.requestNumber})`);
            }

            const deliveryDate = orderItem.actualDelivery || order.actualDeliveryDate;
            const returnWindow = await this.getReturnWindow(orderItem.product);
            const daysSinceDelivery = Math.floor((Date.now() - deliveryDate) / (1000 * 60 * 60 * 24));

            if (daysSinceDelivery > returnWindow.days) {
                if (refundData.returnReason.category !== 'defective_product' ||
                    daysSinceDelivery > returnWindow.extendedForDefective) {
                    throw new Error('Return window has expired');
                }
            }

            const requestedQuantity = Number(refundData?.quantity || orderItem.quantity || 1);
            const sanitizedQuantity = Number.isFinite(requestedQuantity)
                ? Math.max(1, Math.min(Number(orderItem.quantity || 1), Math.floor(requestedQuantity)))
                : Number(orderItem.quantity || 1);

            const refundAmount = await this.calculateRefundAmount(
                orderItem,
                refundData,
                order,
                sanitizedQuantity,
            );

            const requestNumber = await this.generateRequestNumber();
            const vendorId = orderItem.vendor || order.vendor || order.subOrders?.[0]?.vendor || null;
            if (!vendorId) {
                throw new Error('Vendor could not be determined for this order item');
            }

            const autoApproval = this.checkAutoApprovalEligibility(
                refundData.returnReason.category,
                orderItem.finalPrice,
                userId
            );

            // Create refund request
            const refund = new Refund({
                requestNumber,
                order: order._id,
                orderItem: orderItemId,
                customer: userId,
                vendor: vendorId,
                payment: order.paymentId,
                refundType: refundData.refundType || 'return',
                amount: refundAmount.totalRefund,
                returnReason: refundData.returnReason,
                productCondition: refundData.productCondition,
                evidence: refundData.evidence,
                product: {
                    productId: orderItem.product._id,
                    name: orderItem.name,
                    sku: orderItem.product.sku,
                    variant: orderItem.variant,
                    quantity: sanitizedQuantity,
                    price: orderItem.price,
                    totalAmount: refundAmount.itemAmount
                },
                refundAmount,
                returnShipping: {
                    required: refundData.returnReason.category !== 'wrong_item',
                    method: 'courier_pickup',
                    pickupAddress: refundData.pickupAddress || order.shippingAddress,
                    paidBy: this.determineShippingCostPayer(refundData.returnReason.category)
                },
                refundMethod: {
                    type: refundData.refundMethod || 'original_payment'
                },
                autoApproval,
                statusHistory: [{
                    status: autoApproval.eligible ? 'approved' : 'requested',
                    timestamp: new Date(),
                    note: autoApproval.eligible ? 'Auto-approved based on policy' : 'Refund request created',
                    userType: 'customer'
                }]
            });

            if (refundData.refundMethod === 'bank_transfer') {
                refund.refundMethod.bankDetails = refundData.bankDetails;
            }

            await this.saveRefundWithUniqueRequestNumber(refund);

            orderItem.status = 'return_requested';
            orderItem.returnReason = refundData.returnReason.description;
            await order.save();

            await OrderTimeline.create({
                order: order._id,
                orderItem: orderItemId,
                event: 'return_requested',
                title: 'Return Requested',
                description: `Return requested for ${orderItem.name}. Reason: ${refundData.returnReason.category}`,
                actor: userId,
                actorType: 'customer',
                metadata: {
                    requestNumber: refund.requestNumber,
                    reason: refundData.returnReason.category
                }
            });

            return refund;
        
    }

    async calculateRefundAmount(orderItem, refundData, order = null, refundQuantity = null) {
        const quantity = Number(orderItem.quantity || 1);
        const resolvedQuantity = Number.isFinite(refundQuantity)
            ? Math.max(1, Math.min(quantity, Math.floor(refundQuantity)))
            : quantity;

        const unitPrice = quantity > 0
            ? Number(orderItem.finalPrice || 0) / quantity
            : Number(orderItem.price || 0);
        const itemAmount = Math.round(unitPrice * resolvedQuantity);

        const eligibleForShippingRefund = ['defective_product', 'wrong_item', 'not_as_described']
            .includes(refundData.returnReason.category);
        const orderShippingTotal = Number(order?.shippingCharges || 0);
        const orderItemsTotal = Number(order?.itemsTotal || orderItem.finalPrice || 0);
        const orderItemRatio = orderItemsTotal > 0 ? Number(orderItem.finalPrice || 0) / orderItemsTotal : 0;
        const itemShippingShare = Math.round(orderShippingTotal * orderItemRatio);
        const quantityRatio = quantity > 0 ? resolvedQuantity / quantity : 0;
        const shippingRefund = eligibleForShippingRefund
            ? Math.round(itemShippingShare * quantityRatio)
            : 0;

        let deductions = {
            restockingFee: 0,
            returnShippingCharge: 0,
            packagingDamage: 0,
            usageCharge: 0
        };

        if (refundData.productCondition?.packaging === 'damaged') {
            deductions.packagingDamage = Math.round(itemAmount * 0.10); // 10%
        }

        const totalRefund = itemAmount + shippingRefund -
            Object.values(deductions).reduce((sum, val) => sum + val, 0);

        return {
            itemAmount,
            shippingRefund,
            deductions,
            totalRefund
        };

    }

    determineShippingCostPayer(returnReason) {
        if (['defective_product', 'wrong_item', 'not_as_described', 'damaged_in_transit']
            .includes(returnReason)) {
            return 'vendor';
        }

        if (returnReason === 'changed_mind') {
            return 'customer';
        }

        return 'vendor';
    }

    async vendorReviewRefund(refundId, vendorId, reviewData) {
        const refund = await Refund.findById(refundId);

        if (!refund) {
            throw new Error('Refund request is not Found');
        }

        if (refund.vendor.toString() !== vendorId.toString()) {
            throw new Error('Unauthorized access');
        }

        refund.vendorReview = {
            status: reviewData.status,
            reviewedBy: vendorId,
            reviewedAt: new Date(),
            comments: reviewData.comments,
            approvalReason: reviewData.approvalReason,
            rejectionReason: reviewData.rejectionReason
        };

        if (reviewData.status === 'approved') {
            refund.status = 'approved';
            refund.statusHistory.push({
                status: 'approved',
                timestamp: new Date(),
                note: reviewData.approvalReason || 'Approved by vendor',
                updatedBy: vendorId,
                userType: 'vendor'
            });

            if (refund.returnShipping.required) {
                await this.scheduleReturnPickup(refundId);
            }
        }
        else if (reviewData.status === 'rejected') {
            refund.status = 'rejected';
            refund.statusHistory.push({
                status: 'rejected',
                timestamp: new Date(),
                note: reviewData.rejectionReason || 'Rejected by vendor',
                updatedBy: vendorId,
                userType: 'vendor'
            });

            await OrderItem.findByIdAndUpdate(refund.orderItem, { status: 'delivered' });
        }

        await refund.save();

        await OrderTimeline.create({
            order: refund.order,
            orderItem: refund.orderItem,
            event: reviewData.status === 'approved' ? 'return_approved' : 'return_rejected',
            title: reviewData.status === 'approved' ? 'Return Approved' : 'Return Rejected',
            description: reviewData.comments,
            actor: vendorId,
            actorType: 'vendor'
        });

        return refund;
    }

    async scheduleReturnPickup(refundId) {
        const refund = await Refund.findById(refundId)
            .populate('customer');

        const pickupDate = new Date();
        pickupDate.setDate(pickupDate.getDate() + 1);

        if (pickupDate.getDay() === 0) pickupDate.setDate(pickupDate.getDate() + 1);
        if (pickupDate.getDay() === 6) pickupDate.setDate(pickupDate.getDate() + 2);

        refund.returnShipping.pickupScheduled = {
            date: pickupDate,
            timeSlot: {
                start: '09:00',
                end: '18:00'
            }
        };

        refund.status = 'pickup_scheduled';
        refund.statusHistory.push({
            status: 'pickup_scheduled',
            timestamp: new Date(),
            note: `Pickup scheduled for ${pickupDate.toLocaleDateString()}`,
            userType: 'system'
        });

        await refund.save();
        return refund;
    }

    async updateReturnShippingStatus(refundId, statusData) {
        const refund = await Refund.findById(refundId);

        if (!refund) {
            throw new Error('Refund request not found');
        }

        const { status, trackingNumber, notes } = statusData;

        switch (status) {
            case 'picked_up':
                refund.returnShipping.pickedUpDate = new Date();
                refund.returnShipping.trackingNumber = trackingNumber;
                refund.status = 'picked_up';
                break;

            case 'in_transit':
                refund.status = 'in_transit';
                break;

            case 'received_at_warehouse':
                refund.returnShipping.receivedAtWarehouse = new Date();
                refund.status = 'received_at_warehouse';
                refund.qualityCheck.status = 'pending';
                break;

            case 'pickup_failed':
                refund.returnShipping.pickupAttempts.push({
                    attemptDate: new Date(),
                    status: 'failed',
                    reason: notes,
                    nextAttemptDate: statusData.nextAttemptDate
                });
                break;
        }

        refund.statusHistory.push({
            status,
            timestamp: new Date(),
            note: notes,
            userType: 'courier'
        });

        await refund.save();

        await OrderTimeline.create({
            order: refund.order,
            orderItem: refund.orderItem,
            event: status === 'picked_up' ? 'return_picked_up' : 'return_in_transit',
            title: this.getStatusTitle(status),
            description: notes,
            actorType: 'courier'
        });

        return refund;
    }

    async conductQualityCheck(refundId, inspectorId, checkData) {
        const refund = await Refund.findById(refundId)
            .populate('product.productId');

        if (!refund) {
            throw new Error('Refund request not found');
        }

        if (refund.status !== 'received_at_warehouse') {
            throw new Error('Product must be received at warehouse for quality check');
        }

        refund.qualityCheck = {
            required: true,
            status: 'in_progress',
            inspectedBy: inspectorId,
            inspectionDate: new Date(),
            findings: checkData.findings,
            photos: checkData.photos || [],
            result: {
                approved: checkData.approved,
                refundPercentage: checkData.refundPercentage || 100,
                deductionReason: checkData.deductionReason,
                notes: checkData.notes
            }
        };

        if (checkData.approved) {
            refund.qualityCheck.status = 'passed';
            refund.status = 'quality_check_passed';

            if (checkData.refundPercentage < 100) {
                const originalTotal = refund.refundAmount.totalRefund;
                refund.refundAmount.totalRefund = Math.round(originalTotal * (checkData.refundPercentage / 100));
                refund.amount = refund.refundAmount.totalRefund;
                refund.refundAmount.deductions.other = {
                    amount: originalTotal - refund.refundAmount.totalRefund,
                    reason: checkData.deductionReason
                };
            }

            await this.initiateRefundProcessing(refundId);

        } else {
            refund.qualityCheck.status = 'failed';
            refund.status = 'quality_check_failed';
        }

        refund.statusHistory.push({
            status: refund.status,
            timestamp: new Date(),
            note: checkData.notes,
            updatedBy: inspectorId,
            userType: 'admin'
        });

        await refund.save();

        await OrderTimeline.create({
            order: refund.order,
            orderItem: refund.orderItem,
            event: checkData.approved ? 'quality_check_passed' : 'quality_check_failed',
            title: checkData.approved ? 'Quality Check Passed' : 'Quality Check Failed',
            description: checkData.notes,
            actor: inspectorId,
            actorType: 'admin'
        });

        return refund;
    }

    async customerQualityCheckResponse(refundId, userId, accepted, comments) {
        const refund = await Refund.findById(refundId);

        if (!refund) {
            throw new Error('Refund request not found');
        }

        if (refund.customer.toString() !== userId.toString()) {
            throw new Error('Unauthorized access');
        }

        refund.qualityCheck.customerResponse = {
            accepted,
            comments,
            respondedAt: new Date()
        };

        if (accepted || refund.qualityCheck.status === 'passed') {
            await this.initiateRefundProcessing(refundId);
        } else {
            refund.dispute = {
                raised: true,
                raisedBy: 'customer',
                raisedAt: new Date(),
                reason: 'Quality check dispute',
                description: comments,
                status: 'open'
            };
            refund.status = 'disputed';
        }

        await refund.save();
        return refund;
    }

    async initiateRefundProcessing(refundId) {
        const refund = await Refund.findById(refundId).populate('payment');

        if (!refund) {
            throw new Error('Refund request not found');
        }

        refund.status = 'refund_processing';
        refund.refundProcessing = {
            initiatedAt: new Date(),
            status: 'processing'
        };

        await refund.save();

        try {
            switch (refund.refundMethod.type) {
                case 'original_payment':
                    await this.processOriginalPaymentRefund(refund);
                    break;

                case 'bank_transfer':
                    await this.processBankTransferRefund(refund);
                    break;
            }

        } catch (error) {
            refund.refundProcessing.status = 'failed';
            refund.refundProcessing.failureReason = error.message;
            await refund.save();
            throw error;
        }
    }

    async restoreInventoryForRefund(refund) {
        if (!refund?.orderItem) return;

        const orderItem = await OrderItem.findById(refund.orderItem).select('product quantity status');
        if (!orderItem) return;

        // Avoid restoring stock multiple times for already-refunded items.
        if (String(orderItem.status || '').toLowerCase() === 'refunded') {
            return;
        }

        const requestedQty = Number(refund?.product?.quantity || orderItem.quantity || 1);
        const maxQty = Number(orderItem.quantity || requestedQty || 1);
        const restoreQty = Math.max(1, Math.min(maxQty, requestedQty));

        await InventoryReservationService.restoreStock(orderItem.product, restoreQty);
    }

    async processOriginalPaymentRefund(refund) {
        const payment = await Payment.findById(refund.payment);

        if (!payment) {
            throw new Error('Original payment not found');
        }

        await paymentService.processRefund(payment._id, {
            amount: refund.refundAmount.totalRefund,
            reason: refund.returnReason.category,
            refundMethod: 'original_method',
            initiatedBy: refund.vendor
        });

        refund.refundProcessing.status = 'completed';
        refund.refundProcessing.processedAt = new Date();
        refund.status = 'refund_completed';

        refund.statusHistory.push({
            status: 'refund_completed',
            timestamp: new Date(),
            note: `Refund of LKR ${refund.refundAmount.totalRefund} processed to original payment method`,
            userType: 'system'
        });

        await this.restoreInventoryForRefund(refund);

        await refund.save();

        await OrderItem.findByIdAndUpdate(refund.orderItem, { status: 'refunded' });

        await OrderTimeline.create({
            order: refund.order,
            orderItem: refund.orderItem,
            event: 'refund_completed',
            title: 'Refund Completed',
            description: `Refund of LKR ${refund.refundAmount.totalRefund} processed successfully`,
            actorType: 'system'
        });

        // Send refund completed notification
        try {
            const order = await Order.findById(refund.order);
            if (order) {
                await NotificationService.notifyRefundCompleted(order, refund, refund.refundAmount.totalRefund);
            }
        } catch (error) {
            console.error('Error sending refund notification:', error);
        }
    }

    async processBankTransferRefund(refund) {

        // In real implementation, integrate with bank API
        // For now, mark as pending manual processing

        refund.refundProcessing.status = 'pending';
        refund.refundProcessing.transactionId = `BT${Date.now()}`;

        refund.statusHistory.push({
            status: 'refund_processing',
            timestamp: new Date(),
            note: `Bank transfer initiated to ${refund.refundMethod.bankDetails.bankName} - ${refund.refundMethod.bankDetails.accountNumber}`,
            userType: 'system'
        });

        await refund.save();

        // Send refund initiated notification
        try {
            const order = await Order.findById(refund.order);
            if (order) {
                await NotificationService.notifyRefundInitiated(order, refund, refund.refundAmount.totalRefund);
            }
        } catch (error) {
            console.error('Error sending refund initiated notification:', error);
        }

    }

    async handleDispute(refundId, adminId, resolution) {
        const refund = await Refund.findById(refundId);

        if (!refund) {
            throw new Error('Refund request not found');
        }

        refund.dispute.status = 'resolved';
        refund.dispute.resolution = {
            resolvedBy: adminId,
            resolvedAt: new Date(),
            decision: resolution.decision,
            notes: resolution.notes,
            favoredParty: resolution.favoredParty
        };

        // Apply resolution
        if (resolution.favoredParty === 'customer') {
            await this.initiateRefundProcessing(refundId);
        } else if (resolution.favoredParty === 'vendor') {
            refund.status = 'rejected';
            refund.statusHistory.push({
                status: 'rejected',
                timestamp: new Date(),
                note: `Dispute resolved in favor of vendor: ${resolution.notes}`,
                updatedBy: adminId,
                userType: 'admin'
            });
        }

        await refund.save();
        return refund;
    }

    async submitFeedback(refundId, userId, feedbackData) {
        const refund = await Refund.findById(refundId);

        if (!refund) {
            throw new Error('Refund request not found');
        }

        if (refund.customer.toString() !== userId.toString()) {
            throw new Error('Unauthorized access');
        }

        refund.feedback = {
            rating: feedbackData.rating,
            processRating: feedbackData.processRating,
            comments: feedbackData.comments,
            submittedAt: new Date(),
            wouldRecommend: feedbackData.wouldRecommend
        };

        await refund.save();
        return refund;
    }

    getStatusTitle(status) {
        const titles = {
            'picked_up': 'Return Picked Up',
            'in_transit': 'Return In Transit',
            'received_at_warehouse': 'Received at Warehouse',
            'pickup_failed': 'Pickup Failed'
        };
        return titles[status] || status;
    }

    async getRefundDetails(refundId, userId, userRole) {
        const refund = await Refund.findById(refundId)
            .populate('order')
            .populate('customer', 'name email phone')
            .populate('vendor', 'name email storeName')
            .populate('product.productId');

        if (!refund) {
            throw new Error('Refund request not found');
        }

        const isCustomer = refund.customer._id.toString() === userId.toString();
        const isVendor = refund.vendor._id.toString() === userId.toString();
        const isAdmin = userRole === 'admin';

        if (!isCustomer && !isVendor && !isAdmin) {
            throw new Error('Unauthorized access');
        }

        return refund;
    }

    async getCustomerRefunds(userId, filters = {}) {
        const query = { customer: userId };

        if (filters.status) {
            query.status = filters.status;
        }

        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 10;

        const refunds = await Refund.find(query)
            .populate('product.productId', 'name images')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit);

        const total = await Refund.countDocuments(query);

        return {
            refunds,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async getVendorRefunds(vendorId, filters = {}) {
        const query = { vendor: vendorId };

        if (filters.status) {
            query.status = filters.status;
        }

        const page = parseInt(filters.page) || 1;
        const limit = parseInt(filters.limit) || 10;

        const refunds = await Refund.find(query)
            .populate('customer', 'name phone')
            .populate('vendor', 'name email shopName')
            .populate('order', 'orderNumber totalAmount paymentStatus overallStatus')
            .populate('orderItem', 'product vendor name quantity price finalPrice status')
            .populate('product.productId', 'name images')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit);

        const total = await Refund.countDocuments(query);

        return {
            refunds,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async getAdminRefunds(filters = {}) {
        const query = {};

        if (filters.status) {
            query.status = filters.status;
        }

        if (filters.returnStatus) {
            query.returnStatus = filters.returnStatus;
        }

        const page = parseInt(filters.page, 10) || 1;
        const limit = parseInt(filters.limit, 10) || 20;

        const refunds = await Refund.find(query)
            .populate('order', 'orderNumber totalAmount paymentStatus overallStatus')
            .populate('customer', 'name email')
            .populate('payment', 'paymentMethod status transactionId gatewayTransactionId')
            .populate('product.productId', 'name images')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit);

        const total = await Refund.countDocuments(query);

        return {
            refunds,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    async resolvePaymentForOrder(order, paymentId) {
        const paymentLookupId = paymentId || order.paymentId || order.payment;
        if (!paymentLookupId) {
            return null;
        }

        return Payment.findById(paymentLookupId);
    }

    async createRefundRequestByOrder(refundData, userId) {
        const { orderId, orderItemId, paymentId, amount, reason, refundType = 'return', returnStatus = 'pending' } = refundData;

        if (!userId) {
            throw new Error('Customer authentication is required');
        }

        if (!orderId) {
            throw new Error('orderId is required');
        }

        if (!reason || !String(reason).trim()) {
            throw new Error('reason is required');
        }

        const order = await Order.findById(orderId).populate({
            path: 'items',
            populate: { path: 'product' }
        });
        if (!order) {
            throw new Error('Order not found');
        }

        const existingRefundQuery = {
            customer: userId,
            order: order._id,
            status: { $nin: ['rejected', 'cancelled'] }
        };

        if (orderItemId) {
            existingRefundQuery.orderItem = orderItemId;
        }

        const existingOrderRefund = await Refund.findOne(existingRefundQuery).sort({ createdAt: -1 });

        if (existingOrderRefund) {
            throw new Error(`A refund request already exists for this order (${existingOrderRefund.requestNumber})`);
        }

        const orderStatus = String(order.overallStatus || order.status || '').toLowerCase();
        if (orderStatus !== 'delivered') {
            throw new Error('Refund only after delivery');
        }

        const deliveryDate = order.actualDeliveryDate || order.updatedAt || order.createdAt;
        const daysSinceDelivery = Math.floor((Date.now() - new Date(deliveryDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceDelivery > 7) {
            throw new Error('Return period has expired');
        }

        const payment = await this.resolvePaymentForOrder(order, paymentId);
        if (payment && String(payment.status || '').toLowerCase() === 'refunded') {
            throw new Error('Order is already refunded');
        }

        const targetOrderItem = orderItemId
            ? (order.items || []).find((item) => String(item?._id) === String(orderItemId))
            : (order.items || []).find((item) => String(item?.status || '').toLowerCase() === 'delivered') || order.items?.[0];

        if (!targetOrderItem) {
            throw new Error('No eligible order item found for refund');
        }

        const vendorId = targetOrderItem.vendor || order.vendor || order.subOrders?.[0]?.vendor || null;
        if (!vendorId) {
            throw new Error('Vendor could not be determined for this order');
        }

        const requestNumber = await this.generateRequestNumber();

        const refundAmountValue = Number(amount ?? order.totalAmount ?? 0);
        if (!Number.isFinite(refundAmountValue) || refundAmountValue <= 0) {
            throw new Error('Refund amount must be greater than zero');
        }
        const returnReason = {
            category: 'other',
            description: String(reason).trim(),
            detailedExplanation: refundData.details || refundData.detailedExplanation || String(reason).trim(),
        };

        const refund = new Refund({
            requestNumber,
            order: order._id,
            orderItem: targetOrderItem?._id,
            customer: userId,
            vendor: vendorId,
            payment: payment?._id,
            refundType,
            amount: refundAmountValue,
            refundTransactionId: '',
            returnStatus,
            returnReason,
            product: targetOrderItem ? {
                productId: targetOrderItem.product?._id,
                name: targetOrderItem.product?.name || targetOrderItem.name,
                sku: targetOrderItem.product?.sku,
                variant: targetOrderItem.variant,
                quantity: targetOrderItem.quantity,
                price: targetOrderItem.price,
                totalAmount: targetOrderItem.finalPrice,
            } : {
                name: `Order ${order.orderNumber || order._id}`,
                quantity: 1,
                totalAmount: refundAmountValue,
            },
            refundAmount: {
                itemAmount: refundAmountValue,
                shippingRefund: 0,
                deductions: {
                    returnShippingCharge: 0,
                    packagingDamage: 0,
                    usageCharge: 0,
                },
                totalRefund: refundAmountValue,
                currency: order.currency || 'LKR',
            },
            returnShipping: {
                required: true,
                method: 'courier_pickup',
                pickupAddress: order.shippingAddress,
                paidBy: 'vendor',
            },
            refundMethod: {
                type: payment?.paymentMethod === 'cod' ? 'manual' : 'original_payment',
            },
            status: 'requested',
            statusHistory: [{
                status: 'requested',
                timestamp: new Date(),
                note: 'Refund request created',
                userType: 'customer',
            }],
        });

        await this.saveRefundWithUniqueRequestNumber(refund);

        await OrderTimeline.create({
            order: order._id,
            orderItem: targetOrderItem?._id,
            event: 'return_requested',
            title: 'Return Requested',
            description: `Refund requested for order ${order.orderNumber || order._id}`,
            actor: userId,
            actorType: 'customer',
            metadata: {
                requestNumber: refund.requestNumber,
                amount: refundAmountValue,
            }
        });

        return refund;
    }

    async approveOrRejectRefund(refundId, adminId, reviewData = {}) {
        const refund = await Refund.findById(refundId).populate('payment').populate('order');

        if (!refund) {
            throw new Error('Refund request not found');
        }

        const normalized = String(reviewData.status || '').toLowerCase();
        if (!['approved', 'rejected'].includes(normalized)) {
            throw new Error('status must be Approved or Rejected');
        }

        refund.adminReview = {
            required: true,
            status: normalized,
            reviewedBy: adminId,
            reviewedAt: new Date(),
            comments: reviewData.comments || reviewData.reason || '',
        };

        if (normalized === 'rejected') {
            refund.status = 'rejected';
            refund.statusHistory.push({
                status: 'rejected',
                timestamp: new Date(),
                note: reviewData.comments || reviewData.reason || 'Refund rejected',
                updatedBy: adminId,
                userType: 'admin'
            });

            await refund.save();
            return refund;
        }

        refund.status = 'approved';
        refund.statusHistory.push({
            status: 'approved',
            timestamp: new Date(),
            note: reviewData.comments || reviewData.reason || 'Refund approved',
            updatedBy: adminId,
            userType: 'admin'
        });

        await refund.save();
        return refund;
    }

    async updateReturnStatus(refundId, statusData = {}, updatedBy = null, userType = 'courier') {
        const refund = await Refund.findById(refundId).populate('payment').populate('order');

        if (!refund) {
            throw new Error('Refund request not found');
        }

        const normalizedStatus = String(statusData.returnStatus || statusData.status || '').toLowerCase();
        const normalizedUserType = (() => {
            const value = String(userType || 'courier').toLowerCase().replace('_', '');
            if (value === 'superadmin') return 'admin';
            if (['customer', 'vendor', 'admin', 'system', 'courier'].includes(value)) return value;
            return 'system';
        })();

        if (!['pending', 'picked', 'received', 'not_required'].includes(normalizedStatus)) {
            throw new Error('Invalid return status');
        }

        refund.returnStatus = normalizedStatus;
        refund.returnShipping = refund.returnShipping || {};

        if (normalizedStatus === 'picked') {
            refund.returnShipping.pickedUpDate = new Date();
        }

        if (normalizedStatus === 'received') {
            refund.returnShipping.receivedAtWarehouse = new Date();
        }

        refund.statusHistory.push({
            status: refund.status,
            timestamp: new Date(),
            note: `Return status updated to ${normalizedStatus}`,
            updatedBy,
            userType: normalizedUserType,
        });

        await refund.save();

        if (normalizedStatus === 'received') {
            await this.processApprovedRefund(refund._id, updatedBy || refund.customer);
        }

        return refund;
    }

    async processApprovedRefund(refundId, processedBy = null) {
        const refund = await Refund.findById(refundId).populate('payment').populate('order');

        if (!refund) {
            throw new Error('Refund request not found');
        }

        if (refund.status !== 'approved' && refund.status !== 'refund_processing' && refund.status !== 'received_at_warehouse') {
            throw new Error('Refund must be approved before processing');
        }

        refund.status = 'refund_processing';
        refund.refundProcessing = {
            initiatedAt: new Date(),
            initiatedBy: processedBy,
            status: 'processing',
        };

        await refund.save();

        const refundAmount = Number(refund.amount || refund.refundAmount?.totalRefund || 0);
        let refundTransactionId = `REFUND_${Date.now()}`;

        const payment = refund.payment || await this.resolvePaymentForOrder(refund.order, null);
        const paymentMethod = String(payment?.paymentMethod || '').toLowerCase();

        if (payment && paymentMethod === 'card') {
            await paymentService.processRefund(payment._id, {
                amount: refundAmount,
                reason: refund.returnReason?.description || 'requested_by_customer',
                refundMethod: 'original_method',
                initiatedBy: processedBy,
            });

            const refreshedPayment = await Payment.findById(payment._id);
            const latestRefund = refreshedPayment?.refunds?.[refreshedPayment.refunds.length - 1];
            refundTransactionId = latestRefund?.gatewayRefundId || latestRefund?.refundId || refundTransactionId;
        } else {
            if (payment) {
                payment.refunds = payment.refunds || [];
                payment.refunds.push({
                    refundId: refundTransactionId,
                    amount: refundAmount,
                    reason: refund.returnReason?.description || 'requested_by_customer',
                    status: 'completed',
                    initiatedBy: processedBy,
                    initiatedAt: new Date(),
                    processedAt: new Date(),
                    refundMethod: 'manual',
                    notes: 'Manual refund required for COD/offline payments',
                });
                payment.status = 'refunded';
                await payment.save();
            }

            if (refund.order) {
                refund.order.paymentStatus = 'refunded';
                refund.order.overallStatus = 'refunded';
                await refund.order.save();
            }
        }

        refund.refundTransactionId = refundTransactionId;
        refund.refundProcessing.status = 'completed';
        refund.refundProcessing.processedAt = new Date();
        refund.status = 'refund_completed';
        refund.statusHistory.push({
            status: 'refund_completed',
            timestamp: new Date(),
            note: `Refund processed (${refundTransactionId})`,
            updatedBy: processedBy,
            userType: 'system',
        });

        await this.restoreInventoryForRefund(refund);

        if (refund.order) {
            refund.order.paymentStatus = 'refunded';
            refund.order.overallStatus = 'refunded';
            await refund.order.save();
        }

        await refund.save();
        return refund;
    }
}

module.exports = new RefundService();