const Refund = require('../models/refund.model');
const Order = require('../models/order.model');
const Payment = require('../models/payment.model');
const OrderTimeline = require('../models/timeline.model');
const paymentService = require('./payment.service');

class RefundService {

    async creaetRefundRequest(refundData, userId, orderItemId) {
        try {
            const order = await Order.findOne({
                'items._id': orderItemId,
                user: userId
            }).populate('items.product');

            if (!order) {
                throw new Error('Order not found or unauthorized');
            }

            const orderItem = order.items.id(orderItemId);
            if (!orderItem) {
                throw new Error('Order Item not found');
            }

            if (orderItem.status !== 'delivered') {
                throw new Error('Can only request refund for delivered items');
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

            const refundAmount = await this.calculateRefundAmount(
                orderItem,
                refundData,
            );

            const autoApproval = this.checkAutoApprovalEligibility(
                refundData.returnReason.category,
                orderItem.finalPrice,
                userId
            );

            // Create refund request
            const refund = new Refund({
                order: order._id,
                orderItem: orderItemId,
                customer: userId,
                vendor: orderItem.vendor,
                payment: order.paymentId,
                refundType: refundData.refundType || 'return',
                returnReason: refundData.returnReason,
                productCondition: refundData.productCondition,
                evidence: refundData.evidence,
                product: {
                    productId: orderItem.product._id,
                    name: orderItem.name,
                    sku: orderItem.product.sku,
                    variant: orderItem.variant,
                    quantity: refundData.quantity || orderItem.quantity,
                    price: orderItem.price,
                    totalAmount: orderItem.finalPrice
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

            await refund.save();

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
        } catch (error) {
            throw Error;
        }
    }

    async calculateRefundAmount(orderItem, refundData) {
        const itemAmount = orderItem.finalPrice;

        const shippingRefund = ['defective_product', 'wrong_item', 'not_as_described']
            .includes(refundData.returnReason.category) ? (orderItem.shippingCharge || 0) : 0;

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

            const order = await Order.findById(refund.order);
            const item = order.items.id(refund.orderItem);
            item.status = 'delivered';
            await order.save();
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

        await refund.save();

        const order = await Order.findById(refund.order);
        const item = order.items.id(refund.orderItem);
        item.status = 'refunded';
        await order.save();

        await OrderTimeline.create({
            order: refund.order,
            orderItem: refund.orderItem,
            event: 'refund_completed',
            title: 'Refund Completed',
            description: `Refund of LKR ${refund.refundAmount.totalRefund} processed successfully`,
            actorType: 'system'
        });
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
}

module.exports = new RefundService();