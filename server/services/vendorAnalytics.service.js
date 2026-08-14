const SubOrder = require('../models/subOrder.model');
const Refund = require('../models/refund.model');
const Review = require('../models/review.model');
const mongoose = require('mongoose');

/**
 * Vendor Analytics Service - Comprehensive seller metrics and insights
 */
class VendorAnalyticsService {
    /**
     * Get comprehensive dashboard metrics for a vendor
     */
    static async getVendorDashboardMetrics(vendorId, dateRange = '30d') {
        try {
            const startDate = this._getStartDate(dateRange);
            const endDate = new Date();

            const [
                salesMetrics,
                orderMetrics,
                productMetrics,
                customerMetrics,
                refundMetrics
            ] = await Promise.all([
                this.getSalesMetrics(vendorId, startDate, endDate),
                this.getOrderMetrics(vendorId, startDate, endDate),
                this.getProductMetrics(vendorId, startDate, endDate),
                this.getCustomerMetrics(vendorId, startDate, endDate),
                this.getRefundMetrics(vendorId, startDate, endDate)
            ]);

            return {
                dateRange: { startDate, endDate },
                salesMetrics,
                orderMetrics,
                productMetrics,
                customerMetrics,
                refundMetrics,
                overallHealth: this._calculateHealthScore(
                    salesMetrics,
                    orderMetrics,
                    refundMetrics,
                    customerMetrics
                )
            };
        } catch (error) {
            console.error('Error fetching vendor dashboard metrics:', error);
            throw error;
        }
    }

    /**
     * Get sales metrics (revenue, trend, etc.)
     */
    static async getSalesMetrics(vendorId, startDate, endDate) {
        try {
            const subOrders = await SubOrder.find({
                seller: vendorId,
                createdAt: { $gte: startDate, $lte: endDate },
                status: { $ne: 'cancelled' }
            });

            const totalRevenue = subOrders.reduce((sum, so) => sum + (so.totalAmount || 0), 0);
            const totalOrders = subOrders.length;
            const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            // Get daily sales for chart
            const dailySales = await SubOrder.aggregate([
                {
                    $match: {
                        seller: new mongoose.Types.ObjectId(vendorId),
                        createdAt: { $gte: startDate, $lte: endDate },
                        status: { $ne: 'cancelled' }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                        },
                        dailyRevenue: { $sum: '$totalAmount' },
                        ordersCount: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            // Compare with previous period
            const previousStartDate = new Date(startDate);
            previousStartDate.setDate(previousStartDate.getDate() - (endDate.getDate() - startDate.getDate()));
            
            const previousRevenue = await SubOrder.aggregate([
                {
                    $match: {
                        seller: new mongoose.Types.ObjectId(vendorId),
                        createdAt: { $gte: previousStartDate, $lt: startDate },
                        status: { $ne: 'cancelled' }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$totalAmount' }
                    }
                }
            ]);

            const prevRevenue = previousRevenue[0]?.total || 0;
            const revenueTrend = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

            return {
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                averageOrderValue: Math.round(averageOrderValue * 100) / 100,
                totalOrders,
                revenueTrend: Math.round(revenueTrend * 100) / 100,
                dailySales
            };
        } catch (error) {
            console.error('Error calculating sales metrics:', error);
            throw error;
        }
    }

    /**
     * Get order metrics (fulfillment, status breakdown, etc.)
     */
    static async getOrderMetrics(vendorId, startDate, endDate) {
        try {
            const orders = await SubOrder.find({
                seller: vendorId,
                createdAt: { $gte: startDate, $lte: endDate }
            });

            const statusBreakdown = {};
            const paymentStatusBreakdown = {};

            orders.forEach(order => {
                statusBreakdown[order.status] = (statusBreakdown[order.status] || 0) + 1;
                paymentStatusBreakdown[order.paymentStatus] = (paymentStatusBreakdown[order.paymentStatus] || 0) + 1;
            });

            const fulfilledOrders = orders.filter(o => o.status === 'delivered').length;
            const fulfillmentRate = orders.length > 0 ? (fulfilledOrders / orders.length) * 100 : 0;
            const averageFulfillmentTime = await this._calculateAverageFulfillmentTime(vendorId, startDate, endDate);

            return {
                totalOrders: orders.length,
                fulfillmentRate: Math.round(fulfillmentRate * 100) / 100,
                averageFulfillmentDays: Math.round(averageFulfillmentTime),
                statusBreakdown,
                paymentStatusBreakdown
            };
        } catch (error) {
            console.error('Error calculating order metrics:', error);
            throw error;
        }
    }

    /**
     * Get product metrics (top products, inventory alerts, etc.)
     */
    static async getProductMetrics(vendorId, startDate, endDate) {
        try {
            // Top products by revenue
            const topProducts = await SubOrder.aggregate([
                {
                    $match: {
                        seller: new mongoose.Types.ObjectId(vendorId),
                        createdAt: { $gte: startDate, $lte: endDate }
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
                        _id: '$productDetails._id',
                        productName: { $first: '$productDetails.name' },
                        sku: { $first: '$productDetails.sku' },
                        totalSold: { $sum: '$itemDetails.quantity' },
                        totalRevenue: { $sum: '$itemDetails.total' },
                        avgRating: { $avg: '$productDetails.rating' }
                    }
                },
                { $sort: { totalRevenue: -1 } },
                { $limit: 5 }
            ]);

            // Total products
            const Product = require('../models/product');
            const totalProducts = await Product.countDocuments({ createdBy: vendorId, isActive: true });

            return {
                totalProducts,
                topProducts: topProducts.map(p => ({
                    ...p,
                    totalRevenue: Math.round(p.totalRevenue * 100) / 100
                }))
            };
        } catch (error) {
            console.error('Error calculating product metrics:', error);
            throw error;
        }
    }

    /**
     * Get customer metrics (repeat customers, new customers, etc.)
     */
    static async getCustomerMetrics(vendorId, startDate, endDate) {
        try {
            const allTimeOrders = await SubOrder.find({ seller: vendorId });
            const periodOrders = await SubOrder.find({
                seller: vendorId,
                createdAt: { $gte: startDate, $lte: endDate }
            });

            // Unique customers in period
            const uniqueCustomersInPeriod = new Set(periodOrders.map(o => o.customer?.toString()));
            const newCustomers = uniqueCustomersInPeriod.size;

            // Repeat customers (those who ordered more than once)
            const customerOrderCounts = {};
            allTimeOrders.forEach(order => {
                const customerId = order.customer?.toString();
                if (customerId) {
                    customerOrderCounts[customerId] = (customerOrderCounts[customerId] || 0) + 1;
                }
            });

            const repeatCustomers = Object.values(customerOrderCounts).filter(count => count > 1).length;
            const repeatCustomerRate = Object.keys(customerOrderCounts).length > 0 
                ? (repeatCustomers / Object.keys(customerOrderCounts).length) * 100 
                : 0;

            // Average review rating
            const reviews = await Review.find({
                product: { $in: await this._getVendorProducts(vendorId) }
            });

            const avgRating = reviews.length > 0 
                ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
                : 0;

            return {
                newCustomersInPeriod: newCustomers,
                repeatCustomers,
                repeatCustomerRate: Math.round(repeatCustomerRate * 100) / 100,
                totalReviews: reviews.length,
                averageRating: Math.round(avgRating * 100) / 100
            };
        } catch (error) {
            console.error('Error calculating customer metrics:', error);
            throw error;
        }
    }

    /**
     * Get refund metrics (refund rate, reason breakdown, etc.)
     */
    static async getRefundMetrics(vendorId, startDate, endDate) {
        try {
            const subOrderIds = await SubOrder.find({
                seller: vendorId,
                createdAt: { $gte: startDate, $lte: endDate }
            }).select('_id');

            const refunds = await Refund.find({
                subOrderId: { $in: subOrderIds.map(s => s._id) },
                createdAt: { $gte: startDate, $lte: endDate }
            });

            const totalRefundAmount = refunds.reduce((sum, r) => sum + (r.refundAmount || 0), 0);
            const approvedRefunds = refunds.filter(r => r.status === 'approved').length;

            // Reason breakdown
            const reasonBreakdown = {};
            refunds.forEach(refund => {
                const reason = refund.reason || 'Other';
                reasonBreakdown[reason] = (reasonBreakdown[reason] || 0) + 1;
            });

            const refundRate = subOrderIds.length > 0 
                ? (approvedRefunds / subOrderIds.length) * 100 
                : 0;

            return {
                totalRefundRequests: refunds.length,
                approvedRefunds,
                refundRate: Math.round(refundRate * 100) / 100,
                totalRefundAmount: Math.round(totalRefundAmount * 100) / 100,
                reasonBreakdown
            };
        } catch (error) {
            console.error('Error calculating refund metrics:', error);
            throw error;
        }
    }

    /**
     * Get analytics over time (daily/weekly/monthly aggregation)
     */
    static async getTimeSeriesAnalytics(vendorId, dateRange = '30d', granularity = 'daily') {
        try {
            const startDate = this._getStartDate(dateRange);
            const endDate = new Date();

            const formatString = granularity === 'daily' ? '%Y-%m-%d'
                : granularity === 'weekly' ? '%Y-W%V'
                : '%Y-%m';

            const timeSeries = await SubOrder.aggregate([
                {
                    $match: {
                        seller: new mongoose.Types.ObjectId(vendorId),
                        createdAt: { $gte: startDate, $lte: endDate },
                        status: { $ne: 'cancelled' }
                    }
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: formatString, date: '$createdAt' }
                        },
                        revenue: { $sum: '$totalAmount' },
                        orders: { $sum: 1 },
                        avgOrderValue: { $avg: '$totalAmount' }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            return timeSeries.map(data => ({
                period: data._id,
                revenue: Math.round(data.revenue * 100) / 100,
                orders: data.orders,
                avgOrderValue: Math.round(data.avgOrderValue * 100) / 100
            }));
        } catch (error) {
            console.error('Error fetching time series analytics:', error);
            throw error;
        }
    }

    /**
     * Get earnings breakdown (by category, payment method, etc.)
     */
    static async getEarningsBreakdown(vendorId, dateRange = '30d') {
        try {
            const startDate = this._getStartDate(dateRange);
            const endDate = new Date();

            // By category
            const byCategory = await SubOrder.aggregate([
                {
                    $match: {
                        seller: new mongoose.Types.ObjectId(vendorId),
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
                        earnings: { $sum: '$itemDetails.total' },
                        orders: { $sum: 1 }
                    }
                },
                { $sort: { earnings: -1 } }
            ]);

            return {
                byCategory: byCategory.map(cat => ({
                    category: cat._id,
                    earnings: Math.round(cat.earnings * 100) / 100,
                    orders: cat.orders
                }))
            };
        } catch (error) {
            console.error('Error fetching earnings breakdown:', error);
            throw error;
        }
    }

    // ========== PRIVATE HELPER METHODS ==========

    static _getStartDate(dateRange) {
        const now = new Date();
        const startDate = new Date();

        switch (dateRange) {
            case '7d':
                startDate.setDate(now.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(now.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(now.getDate() - 90);
                break;
            case '1y':
                startDate.setFullYear(now.getFullYear() - 1);
                break;
            default:
                startDate.setDate(now.getDate() - 30);
        }

        startDate.setHours(0, 0, 0, 0);
        return startDate;
    }

    static async _calculateAverageFulfillmentTime(vendorId, startDate, endDate) {
        try {
            const deliveredOrders = await SubOrder.find({
                seller: vendorId,
                createdAt: { $gte: startDate, $lte: endDate },
                status: 'delivered',
                'payoutDetails.payoutDate': { $exists: true }
            });

            if (deliveredOrders.length === 0) return 0;

            const totalTime = deliveredOrders.reduce((sum, order) => {
                const fulfillmentTime = (order.updatedAt - order.createdAt) / (1000 * 60 * 60 * 24); // in days
                return sum + fulfillmentTime;
            }, 0);

            return totalTime / deliveredOrders.length;
        } catch (error) {
            console.error('Error calculating average fulfillment time:', error);
            return 0;
        }
    }

    static async _getVendorProducts(vendorId) {
        try {
            const Product = require('../models/product');
            const products = await Product.find({ createdBy: vendorId }).select('_id');
            return products.map(p => p._id);
        } catch (error) {
            return [];
        }
    }

    static _calculateHealthScore(salesMetrics, orderMetrics, refundMetrics, customerMetrics) {
        let score = 100;

        // Deduct for low fulfillment rate
        score -= (100 - orderMetrics.fulfillmentRate) * 0.3;

        // Deduct for high refund rate
        score -= refundMetrics.refundRate * 0.25;

        // Deduct for low rating
        score -= (5 - customerMetrics.averageRating) * 5;

        // Bonus for high repeat customer rate
        if (customerMetrics.repeatCustomerRate > 50) score += 10;

        return Math.max(0, Math.min(100, Math.round(score)));
    }
}

module.exports = VendorAnalyticsService;
