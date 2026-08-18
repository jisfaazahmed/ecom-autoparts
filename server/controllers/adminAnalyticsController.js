const SubOrder = require('../models/subOrder.model');
const Order = require('../models/order.model');
const Refund = require('../models/refund.model');
const User = require('../models/user');
const mongoose = require('mongoose');

// Helper to calculate date ranges
const getStartDate = (range) => {
    const now = new Date();
    const startDate = new Date();
    switch (range) {
        case '7d': startDate.setDate(now.getDate() - 7); break;
        case '30d': startDate.setDate(now.getDate() - 30); break;
        case '90d': startDate.setDate(now.getDate() - 90); break;
        case '1y': startDate.setFullYear(now.getFullYear() - 1); break;
        default: startDate.setDate(now.getDate() - 30);
    }
    startDate.setHours(0, 0, 0, 0);
    return startDate;
};

exports.getSuperAdminAnalytics = async (req, res) => {
    try {
        const { range = '30d' } = req.query;
        const startDate = getStartDate(range);
        const endDate = new Date();

        // 1. Total active vendors
        const totalVendors = await User.countDocuments({ role: 'ADMIN', status: 'ACTIVE' });

        // 2. Aggregate Sales & Commission (SuperAdmin)
        // We use SubOrders to easily compute commission based on vendor's commissionRate
        let subOrders = await SubOrder.find({
            createdAt: { $gte: startDate, $lte: endDate },
            status: { $ne: 'cancelled' }
        }).lean();

        try {
            subOrders = await SubOrder.populate(subOrders, { path: 'seller', select: 'commissionRate' });
        } catch (populateErr) {
            console.warn('Analytics: seller populate skipped, using subOrder.commissionRate:', populateErr.message);
        }

        let totalSales = 0;
        let totalCommission = 0;
        let ordersByStatusMap = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 };
        
        // Month by month grouping for charts
        let monthlyAggr = {};

        // Loop through all suborders
        subOrders.forEach(so => {
            const amount = Number(so.totalAmount || 0);
            const status = so.status || 'pending';
            const sellerRate = so.seller && typeof so.seller === 'object'
                ? so.seller.commissionRate
                : null;
            const rate = Number(sellerRate ?? so.commissionRate ?? 10) / 100;

            totalSales += amount;
            totalCommission += amount * rate;
            
            if (ordersByStatusMap[status] !== undefined) {
                ordersByStatusMap[status] += 1;
            } else {
                ordersByStatusMap[status] = 1; // Fallback
            }

            // Monthly breakdown
            const created = so.createdAt ? new Date(so.createdAt) : null;
            if (!created || Number.isNaN(created.getTime())) return;
            const period = created.toISOString().slice(0, 7); // YYYY-MM
            if (!monthlyAggr[period]) {
                monthlyAggr[period] = { sales: 0, commission: 0, orders: 0 };
            }
            monthlyAggr[period].sales += amount;
            monthlyAggr[period].commission += amount * rate;
            monthlyAggr[period].orders += 1;
        });

        // Calculate all cancelled suborders for the status breakdown
        const cancelledSubOrders = await SubOrder.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate },
            status: 'cancelled'
        });
        ordersByStatusMap['cancelled'] = cancelledSubOrders;

        // Note: For accurately matching frontend exact Orders, we can count distinct `order` references.
        const distinctOrderSet = new Set(
            subOrders.map((so) => (so.order ? String(so.order) : null)).filter(Boolean)
        );
        const totalOrders = distinctOrderSet.size;

        // Calculate Average Order Value (AOV)
        const aov = totalOrders > 0 ? (totalSales / totalOrders) : 0;

        // Fetch Total Refunds from the Refund model
        const refunds = await Refund.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: { $in: ['COMPLETED', 'refund_completed'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRefundAmount: { $sum: '$amount' }
                }
            }
        ]);
        const totalRefunds = refunds.length > 0 ? refunds[0].totalRefundAmount : 0;

        const salesByMonth = Object.keys(monthlyAggr).sort().map(month => ({
            month,
            sales: monthlyAggr[month].sales,
            commission: monthlyAggr[month].commission,
            orders: monthlyAggr[month].orders
        }));

        // 3. Top Categories logic
        const topCategoriesData = await SubOrder.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: { $ne: 'cancelled' }
                }
            },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'orderitems',
                    localField: 'items',
                    foreignField: '_id',
                    as: 'itemDetails'
                }
            },
            { $unwind: '$itemDetails' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'itemDetails.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            { $unwind: '$productDetails' },
            {
                $group: {
                    _id: '$productDetails.category',
                    earnings: { $sum: { $ifNull: ['$itemDetails.total', '$itemDetails.finalPrice'] } }
                }
            },
            { $sort: { earnings: -1 } },
            { $limit: 5 }
        ]);

        const topCategories = topCategoriesData.map(c => ({
            categoryId: c._id, 
            earnings: c.earnings
        }));

        // 4. Top Performing Vendors logic
        const topVendorsData = await SubOrder.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate, $lte: endDate },
                    status: { $ne: 'cancelled' }
                }
            },
            {
                $group: {
                    _id: '$seller',
                    sales: { $sum: '$totalAmount' },
                    orders: { $sum: 1 }
                }
            },
            { $sort: { sales: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'vendorDetails'
                }
            },
            { $unwind: '$vendorDetails' },
            {
                $project: {
                    vendorId: '$_id',
                    shopName: '$vendorDetails.shopName',
                    name: '$vendorDetails.name',
                    sales: 1,
                    orders: 1
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                totalSales,
                totalCommission,
                totalOrders,
                totalVendors,
                aov,
                totalRefunds,
                ordersByStatus: ordersByStatusMap,
                salesByMonth,
                topCategories,
                topVendors: topVendorsData
            }
        });

    } catch (err) {
        console.error('Superadmin analytics error:', err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
