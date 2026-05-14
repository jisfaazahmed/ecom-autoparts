const InventoryReservationService = require('../services/inventoryReservation.service');

module.exports.checkStockAvailability = async (req, res) => {
    try {
        const { productId, quantity } = req.body;

        if (!productId || !quantity) {
            return res.status(400).json({
                success: false,
                message: 'productId and quantity are required'
            });
        }

        const isAvailable = await InventoryReservationService.checkStockAvailability(productId, quantity);

        if (!isAvailable) {
            return res.status(400).json({
                success: false,
                message: `Insufficient stock available. Requested: ${quantity}`
            });
        }

        res.status(200).json({
            success: true,
            message: 'Stock available',
            available: true
        });
    } catch (error) {
        console.error('Error checking stock availability:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to check stock availability'
        });
    }
};

module.exports.getStockSummary = async (req, res) => {
    try {
        const { productId } = req.params;

        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID'
            });
        }

        const summary = await InventoryReservationService.getStockSummary(productId);

        res.status(200).json({
            success: true,
            data: summary,
            message: 'Stock summary retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting stock summary:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get stock summary'
        });
    }
};

module.exports.getAvailableStock = async (req, res) => {
    try {
        const { productId } = req.params;

        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid product ID'
            });
        }

        const available = await InventoryReservationService.getAvailableStock(productId);

        res.status(200).json({
            success: true,
            data: {
                available
            },
            message: 'Available stock retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting available stock:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get available stock'
        });
    }
};

module.exports.releaseExpiredReservations = async (req, res) => {
    try {
        const result = await InventoryReservationService.releaseExpiredReservations();

        res.status(200).json({
            success: true,
            data: result,
            message: 'Expired reservations released successfully'
        });
    } catch (error) {
        console.error('Error releasing expired reservations:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to release expired reservations'
        });
    }
};

// Admin only - get all reservations for a product
module.exports.getProductReservations = async (req, res) => {
    try {
        // Check if user is admin/superadmin
        const userRole = req.user?.role;
        if (userRole !== 'admin' && userRole !== 'superadmin') {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Admin only.'
            });
        }

        const { productId } = req.params;

        const reservations = await InventoryReservationService.getProductReservations(productId);

        res.status(200).json({
            success: true,
            data: reservations,
            message: 'Product reservations retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting product reservations:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get product reservations'
        });
    }
};
