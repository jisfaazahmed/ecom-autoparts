const shipping = require('../models/shipping.model');
const shippingService = require('../services/shipping.service');

module.exports.createShipping = async (req, res) => {
    try {
        const shipping = await shippingService.createShipping(
            req.params.orderId,
            req.user._id
        );

        res.status(200).json({
            success: true,
            data: shipping
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports.calculateShipping = async (req, res) => {
    try {
        const cost = await shippingService.calculateShippingCost(req.body);
        res.status(200).json(cost);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports.schedulePickup = async (req, res) => {

    try {
        const shipping = await shippingService.schedulePickup(
            req.params.shippingId,
            req.body
        );
        res.status(200).json(shipping);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

module.exports.updateStatus = async (req, res) => {
    try {
        const status = await shippingService.updateStatus(
            req.body,
            req.params.shippingId
        );
        res.status(200).json(status);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

module.exports.recordDeliveryAttempt = async (req, res) => {
    try {
        const shipping = await shippingService.recordDeliveryAttempt(
            req.params.shippingId,
            req.body
        );

        res.status(200).json(
            shipping
        );
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

module.exports.confirmDelivery = async (req, res) => {
    try {
        const shipping = await shippingService.confirmDelivery(
            req.params.shippingId,
            req.body
        );

        res.status(200).json(shipping);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

module.exports.trackShipment = async (res, req) => {
    try {
        const tracking = await shippingService.trackShipment(
            req.params.trackingNumber
        );
        res.status(200).json(tracking);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

module.exports.getVendorShipments = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        const query = { vendor: req.user._id };
        if (status) query.status = status;

        const shipments = await shipping.find(query)
            .populate('order', 'orderNumber totalAmount')
            .populate('customer', 'name phone')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await shipping.countDocuments(query);

        res.json({
            success: true,
            data: {
                shipments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.getCustomerShipments = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const shipments = await shipping.find({ customer: req.user._id })
            .populate('order', 'orderNumber totalAmount')
            .populate('vendor', 'name storeName')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await shipping.countDocuments({ customer: req.user._id });

        res.json({
            success: true,
            data: {
                shipments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

exports.reportIssue = async (req, res) => {
    try {
        const shipping = await shippingService.reportIssue(
            req.params.shippingId,
            {
                ...req.body,
                reportedBy: req.user.name
            }
        );

        res.json({
            success: true,
            message: 'Issue reported successfully',
            data: shipping
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.submitRating = async (req, res) => {
    try {
        const shipping = await shippingService.submitRating(
            req.params.shippingId,
            req.body
        );

        res.json({
            success: true,
            message: 'Rating submitted successfully',
            data: shipping
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

exports.getShippingDetails = async (req, res) => {
    try {
        const shipping = await shipping.findById(req.params.shippingId)
            .populate('order')
            .populate('vendor', 'name storeName phone')
            .populate('customer', 'name phone email');

        if (!shipping) {
            return res.status(404).json({
                success: false,
                message: 'Shipping not found'
            });
        }

        res.json({
            success: true,
            data: shipping
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
