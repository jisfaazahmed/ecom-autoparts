const shipping = require('../models/shipping.model');
const shippingService = require('../services/shipping.service');

function getActor(req) {
    return {
        userId: String(req.user?._id || req.user?.id || ''),
        role: req.user?.role,
    };
}

// Maps thrown errors to a status code: 403 from authorizeShipment, 404 for
// missing records, 400 for validation failures, 500 otherwise.
function fail(res, error) {
    const message = error?.message || 'Request failed';
    const status = error?.statusCode
        || (/not found/i.test(message) ? 404 : 400);

    return res.status(status).json({ success: false, message });
}

module.exports.createShipping = async (req, res) => {
    try {
        const userId = req.user?._id || req.user?.id;
        const created = await shippingService.createShipping(
            req.params.orderId,
            userId
        );

        res.status(200).json({
            success: true,
            data: created
        });
    }
    catch (error) {
        fail(res, error);
    }
};

module.exports.calculateShipping = async (req, res) => {
    try {
        const cost = await shippingService.calculateShippingCost(req.body);
        res.status(200).json(cost);
    } catch (error) {
        fail(res, error);
    }
};

module.exports.schedulePickup = async (req, res) => {
    try {
        await shippingService.authorizeShipment(req.params.shippingId, getActor(req), ['vendor', 'admin']);

        const updated = await shippingService.schedulePickup(
            req.params.shippingId,
            req.body
        );
        res.status(200).json(updated);
    } catch (error) {
        fail(res, error);
    }
};

module.exports.updateStatus = async (req, res) => {
    try {
        await shippingService.authorizeShipment(req.params.shippingId, getActor(req), ['vendor', 'admin']);

        const status = await shippingService.updateStatus(
            req.params.shippingId,
            { ...req.body, updatedBy: req.user?.name || req.body?.updatedBy }
        );
        res.status(200).json(status);
    } catch (error) {
        fail(res, error);
    }
};

module.exports.recordDeliveryAttempt = async (req, res) => {
    try {
        await shippingService.authorizeShipment(req.params.shippingId, getActor(req), ['admin']);

        const updated = await shippingService.recordDeliveryAttempt(
            req.params.shippingId,
            req.body
        );

        res.status(200).json(updated);
    } catch (error) {
        fail(res, error);
    }
};

module.exports.confirmDelivery = async (req, res) => {
    try {
        await shippingService.authorizeShipment(req.params.shippingId, getActor(req), ['admin']);

        const updated = await shippingService.confirmDelivery(
            req.params.shippingId,
            req.body
        );

        res.status(200).json(updated);
    } catch (error) {
        fail(res, error);
    }
};

module.exports.trackShipment = async (req, res) => {
    try {
        const { trackingNumber } = req.params;

        if (!trackingNumber || trackingNumber.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Tracking number is required'
            });
        }

        const tracking = await shippingService.trackShipment(trackingNumber);
        res.status(200).json(tracking);
    } catch (error) {
        fail(res, error);
    }
};

module.exports.getVendorShipments = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        const userId = req.user?._id || req.user?.id;
        const query = { vendor: userId };
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
        const userId = req.user?._id || req.user?.id;

        const shipments = await shipping.find({ customer: userId })
            .populate('order', 'orderNumber totalAmount')
            .populate('vendor', 'name storeName')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await shipping.countDocuments({ customer: userId });

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
        await shippingService.authorizeShipment(req.params.shippingId, getActor(req), ['vendor', 'customer', 'admin']);

        const updated = await shippingService.reportIssue(
            req.params.shippingId,
            {
                ...req.body,
                reportedBy: req.user?._id || req.user?.id
            }
        );

        res.json({
            success: true,
            message: 'Issue reported successfully',
            data: updated
        });
    } catch (error) {
        fail(res, error);
    }
};

exports.submitRating = async (req, res) => {
    try {
        // Only the recipient may rate the delivery.
        await shippingService.authorizeShipment(req.params.shippingId, getActor(req), ['customer']);

        const updated = await shippingService.submitRating(
            req.params.shippingId,
            req.body
        );

        res.json({
            success: true,
            message: 'Rating submitted successfully',
            data: updated
        });
    } catch (error) {
        fail(res, error);
    }
};

exports.getShippingDetails = async (req, res) => {
    try {
        await shippingService.authorizeShipment(
            req.params.shippingId,
            getActor(req),
            ['vendor', 'customer', 'admin']
        );

        const shipment = await shipping.findById(req.params.shippingId)
            .populate('order');

        res.json({
            success: true,
            data: shipment
        });
    } catch (error) {
        fail(res, error);
    }
};

exports.generateShippingLabel = async (req, res) => {
    try {
        await shippingService.authorizeShipment(req.params.shippingId, getActor(req), ['vendor', 'admin']);

        const label = await shippingService.generateShippingLabel(req.params.shippingId);

        res.json({
            success: true,
            message: 'Shipping label generated successfully',
            data: label
        });
    } catch (error) {
        fail(res, error);
    }
};
