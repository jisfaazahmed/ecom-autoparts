const refundService = require('../services/refund.service');
const Refund = require('../models/refund.model');


exports.createRefundRequest = async (req, res) => {
    try {
        const refund = await refundService.createRefundRequest(
            req.params.orderItemId,
            req.body,
            req.user?.id || req.user?._id
        );

        res.status(200).json(
            {
                success: true,
                message: 'Refund request created successfully',
                data: refund
            }
        )
    } catch (error) {
        res.status(400).json(
            {
                success: false,
                message: error.message
            }
        )
    }
};

exports.createRefundRequestByOrder = async (req, res) => {
    try {
        const customerId = req.user?.id || req.user?._id;
        if (!customerId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required to create refund request'
            });
        }

        const refund = await refundService.createRefundRequestByOrder(req.body, customerId);

        res.status(200).json({
            success: true,
            message: 'Refund request created successfully',
            data: refund
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.getCustomerRefunds = async (req, res)=>{
    try {
        const result = await refundService.getCustomerRefunds(req.user?.id || req.user?._id, req.query);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

exports.getVendorRefunds = async (req, res) => {
    try {
        const result = await refundService.getVendorRefunds(req.user?.id || req.user?._id, req.query);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getAdminRefunds = async (req, res) => {
    try {
        const role = String(req.user?.role || '').toLowerCase();
        if (!['admin', 'superadmin'].includes(role)) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const result = await refundService.getAdminRefunds(req.query);

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getRefundDetails = async (req, res) => {
    try {
        const refund = await refundService.getRefundDetails(
            req.params.refundId,
            req.user?.id || req.user?._id,
            req.user.role
        );

        res.json({
            success: true,
            data: refund
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.vendorReviewRefund = async (req, res) => {
    try {
        const refund = await refundService.vendorReviewRefund(
            req.params.refundId,
            req.user?.id || req.user?._id,
            req.body
        );

        res.json({
            success: true,
            message: `Refund ${req.body.status}`,
            data: refund
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.approveOrRejectRefund = async (req, res) => {
    try {
        const role = String(req.user?.role || '').toLowerCase();
        if (!['admin', 'superadmin'].includes(role)) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const refund = await refundService.approveOrRejectRefund(
            req.params.refundId,
            req.user?.id || req.user?._id,
            req.body
        );

        res.json({
            success: true,
            message: `Refund ${req.body.status}`,
            data: refund
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.updateReturnStatus = async (req, res) => {
    try {
        const refund = await refundService.updateReturnStatus(
            req.params.refundId,
            req.body,
            req.user?.id || req.user?._id,
            req.user?.role
        );

        res.json({
            success: true,
            message: 'Return status updated',
            data: refund
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.updateReturnShipping = async (req, res) => {
    try {
        const refund = await refundService.updateReturnShippingStatus(
            req.params.refundId,
            req.body
        );

        res.json({
            success: true,
            message: 'Return shipping status updated',
            data: refund
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.conductQualityCheck = async (req, res) => {
    try {
        const refund = await refundService.conductQualityCheck(
            req.params.refundId,
            req.user?.id || req.user?._id,
            req.body
        );

        res.json({
            success: true,
            message: 'Quality check completed',
            data: refund
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.qualityCheckResponse = async (req, res) => {
    try {
        const { accepted, comments } = req.body;

        const refund = await refundService.customerQualityCheckResponse(
            req.params.refundId,
            req.user?.id || req.user?._id,
            accepted,
            comments
        );

        res.json({
            success: true,
            message: 'Response submitted',
            data: refund
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


exports.handleDispute = async (req, res) => {
    try {
        const refund = await refundService.handleDispute(
            req.params.refundId,
            req.user._id,
            req.body
        );

        res.json({
            success: true,
            message: 'Dispute resolved',
            data: refund
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.submitFeedback = async (req, res) => {
    try {
        const refund = await refundService.submitFeedback(
            req.params.refundId,
            req.user?.id || req.user?._id,
            req.body
        );

        res.json({
            success: true,
            message: 'Feedback submitted',
            data: refund
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.getRefundStatistics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const stats = await Refund.aggregate([
            {
                $match: {
                    createdAt: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$refundAmount.totalRefund' }
                }
            }
        ]);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = exports;
