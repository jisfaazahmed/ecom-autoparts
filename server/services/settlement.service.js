const SubOrder = require('../models/subOrder.model');
const Refund = require('../models/refund.model');
const Settlement = require('../models/settlement.model');
const User = require('../models/user');
const mongoose = require('mongoose');

/**
 * Settlement Service - Handles vendor payout calculations and settlement management
 */
class SettlementService {
    /**
     * Calculate settlement for a vendor for a given period
     */
    static async calculateVendorSettlement(vendorId, startDate, endDate) {
        try {
            // Fetch all sub-orders for vendor in period
            const subOrders = await SubOrder.find({
                seller: vendorId,
                createdAt: { $gte: startDate, $lte: endDate },
                status: { $ne: 'cancelled' }
            })
                .populate('items')
                .populate('order');

            // Fetch refunds for these orders
            const refunds = await Refund.find({
                vendor: vendorId,
                createdAt: { $gte: startDate, $lte: endDate },
                status: { $in: ['refund_completed'] }
            });

            // Get vendor commission rate and payout bank details
            const vendor = await User.findById(vendorId).select('commissionRate shopName bankDetails');
            const commissionRate = vendor?.commissionRate || 0;

            // Calculate financial metrics
            let totalOrderAmount = 0;
            let totalRefunded = 0;
            let totalOrders = 0;

            // Sum up order amounts
            subOrders.forEach(subOrder => {
                totalOrderAmount += subOrder.totalAmount || 0;
                totalOrders += 1;
            });

            // Sum up refunded amounts
            refunds.forEach(refund => {
                const refundValue = Number(refund.refundAmount?.totalRefund ?? refund.amount ?? 0);
                totalRefunded += Number.isFinite(refundValue) ? refundValue : 0;
            });

            // Calculate net order amount
            const netOrderAmount = totalOrderAmount - totalRefunded;

            // Calculate commission
            const totalCommission = (netOrderAmount * commissionRate) / 100;

            // Calculate charges (can be customized based on business logic)
            const charges = {
                platformFee: Math.max(0, (netOrderAmount * 0.02)), // 2% platform fee
                paymentProcessingFee: Math.max(0, (netOrderAmount * 0.01)), // 1% payment fee
                logisticsFee: 0, // Can be calculated separately
                otherCharges: 0
            };

            const totalCharges = Object.values(charges).reduce((a, b) => a + b, 0);

            // Calculate final payable amount
            const payableAmount = netOrderAmount - totalCommission - totalCharges;

            return {
                vendor: vendorId,
                vendorName: vendor?.shopName || 'Unknown Vendor',
                settlementPeriod: { startDate, endDate },
                ordersSummary: {
                    totalOrders,
                    totalOrderAmount,
                    totalRefunded,
                    netOrderAmount
                },
                commission: {
                    rate: commissionRate,
                    totalCommission
                },
                charges: {
                    ...charges,
                    totalCharges
                },
                payableAmount,
                bankDetails: vendor?.bankDetails || undefined,
                subOrders: subOrders.map(so => so._id),
                refunds: refunds.map(r => ({
                    refundId: r._id,
                    amount: Number(r.refundAmount?.totalRefund ?? r.amount ?? 0),
                    date: r.createdAt
                }))
            };
        } catch (error) {
            console.error('Error calculating vendor settlement:', error);
            throw error;
        }
    }

    /**
     * Find an existing non-cancelled/failed settlement for this vendor whose period
     * overlaps the given range, so the same orders don't get settled twice.
     */
    static async findOverlappingSettlement(vendorId, startDate, endDate) {
        return Settlement.findOne({
            vendor: vendorId,
            status: { $in: ['pending', 'processing', 'completed'] },
            'settlementPeriod.startDate': { $lte: endDate },
            'settlementPeriod.endDate': { $gte: startDate }
        });
    }

    /**
     * Create a settlement record
     */
    static async createSettlement(settlementData, createdBy) {
        try {
            const settlement = new Settlement({
                vendor: settlementData.vendor,
                settlementPeriod: settlementData.settlementPeriod,
                ordersSummary: settlementData.ordersSummary,
                commission: settlementData.commission,
                charges: settlementData.charges,
                payableAmount: settlementData.payableAmount,
                bankDetails: settlementData.bankDetails,
                subOrders: settlementData.subOrders,
                refunds: settlementData.refunds,
                createdBy
            });

            await settlement.save();
            return settlement;
        } catch (error) {
            console.error('Error creating settlement:', error);
            throw error;
        }
    }

    /**
     * Get settlement by ID with populated references
     */
    static async getSettlementById(settlementId) {
        try {
            return await Settlement.findById(settlementId)
                .populate('vendor', 'shopName email')
                .populate('subOrders')
                .populate('createdBy', 'name email');
        } catch (error) {
            console.error('Error fetching settlement:', error);
            throw error;
        }
    }

    /**
     * Get all settlements for a vendor
     */
    static async getVendorSettlements(vendorId, options = {}) {
        try {
            const { page = 1, limit = 10, status, startDate, endDate } = options;
            const skip = (page - 1) * limit;

            const query = { vendor: vendorId };
            if (status) query.status = status;
            if (startDate || endDate) {
                query.$and = [];
                if (startDate) {
                    query.$and.push({ 'settlementPeriod.endDate': { $gte: new Date(startDate) } });
                }
                if (endDate) {
                    query.$and.push({ 'settlementPeriod.startDate': { $lte: new Date(endDate) } });
                }
            }

            const [settlements, total] = await Promise.all([
                Settlement.find(query)
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .populate('vendor', 'shopName')
                    .populate('createdBy', 'name'),
                Settlement.countDocuments(query)
            ]);

            return {
                settlements,
                pagination: {
                    total,
                    pages: Math.ceil(total / limit),
                    currentPage: page,
                    perPage: limit
                }
            };
        } catch (error) {
            console.error('Error fetching vendor settlements:', error);
            throw error;
        }
    }

    /**
     * Get settlement totals for a vendor within a date range
     */
    static async getVendorSettlementRangeSummary(vendorId, startDate, endDate) {
        try {
            const query = {
                vendor: new mongoose.Types.ObjectId(vendorId)
            };

            if (startDate || endDate) {
                query.$and = [];
                if (startDate) {
                    query.$and.push({ 'settlementPeriod.endDate': { $gte: new Date(startDate) } });
                }
                if (endDate) {
                    query.$and.push({ 'settlementPeriod.startDate': { $lte: new Date(endDate) } });
                }
            }

            const result = await Settlement.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        totalSettlements: { $sum: 1 },
                        totalCommission: { $sum: '$commission.totalCommission' },
                        totalPayable: { $sum: '$payableAmount' },
                        totalOrderAmount: { $sum: '$ordersSummary.totalOrderAmount' },
                        totalRefunded: { $sum: '$ordersSummary.totalRefunded' }
                    }
                }
            ]);

            return result[0] || {
                totalSettlements: 0,
                totalCommission: 0,
                totalPayable: 0,
                totalOrderAmount: 0,
                totalRefunded: 0
            };
        } catch (error) {
            console.error('Error fetching vendor settlement range summary:', error);
            throw error;
        }
    }

    /**
     * Update settlement status (pending -> processing -> completed)
     */
    static async updateSettlementStatus(settlementId, newStatus, updateData = {}) {
        try {
            const settlement = await Settlement.findByIdAndUpdate(
                settlementId,
                {
                    status: newStatus,
                    ...(newStatus === 'completed' && { 'payoutDetails.payoutDate': new Date() }),
                    ...updateData,
                    updatedAt: new Date()
                },
                { new: true }
            );

            return settlement;
        } catch (error) {
            console.error('Error updating settlement status:', error);
            throw error;
        }
    }

    /**
     * Process automated settlements for all active vendors
     * Run this as a scheduled job (e.g., daily/weekly)
     */
    static async processAutomatedSettlements(startDate, endDate, createdBy) {
        try {
            // Get all active vendors
            const vendors = await User.find({ role: 'ADMIN', status: 'ACTIVE' });

            const createdSettlements = [];
            const errors = [];

            for (const vendor of vendors) {
                try {
                    // Skip if this vendor already has a settlement covering an overlapping period
                    const existing = await this.findOverlappingSettlement(vendor._id, startDate, endDate);

                    if (existing) {
                        continue; // Skip if already settled for an overlapping period
                    }

                    // Calculate settlement
                    const settlementData = await this.calculateVendorSettlement(
                        vendor._id,
                        startDate,
                        endDate
                    );

                    // Create settlement
                    const settlement = await this.createSettlement(settlementData, createdBy);
                    createdSettlements.push(settlement);
                } catch (error) {
                    errors.push({ vendorId: vendor._id, error: error.message });
                }
            }

            return {
                createdSettlements,
                errors,
                summary: {
                    successCount: createdSettlements.length,
                    errorCount: errors.length,
                    totalVendors: vendors.length
                }
            };
        } catch (error) {
            console.error('Error in processAutomatedSettlements:', error);
            throw error;
        }
    }

    /**
     * Get settlement summary for a vendor (current period)
     */
    static async getVendorSettlementSummary(vendorId) {
        try {
            const now = new Date();
            const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

            const currentSettlement = await Settlement.findOne({
                vendor: vendorId,
                'settlementPeriod.startDate': { $gte: currentMonth },
                'settlementPeriod.endDate': { $lt: nextMonth }
            });

            // If no settlement exists, calculate it on-the-fly
            if (!currentSettlement) {
                return await this.calculateVendorSettlement(vendorId, currentMonth, nextMonth);
            }

            return currentSettlement.toObject();
        } catch (error) {
            console.error('Error fetching settlement summary:', error);
            throw error;
        }
    }

    /**
     * Calculate total payable for vendor (all pending + approved settlements)
     */
    static async getTotalPayable(vendorId) {
        try {
            const result = await Settlement.aggregate([
                {
                    $match: {
                        vendor: new mongoose.Types.ObjectId(vendorId),
                        status: { $in: ['pending', 'processing', 'completed'] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalPayable: { $sum: '$payableAmount' },
                        totalSettlements: { $sum: 1 }
                    }
                }
            ]);

            return result[0] || { totalPayable: 0, totalSettlements: 0 };
        } catch (error) {
            console.error('Error calculating total payable:', error);
            throw error;
        }
    }
}

module.exports = SettlementService;
