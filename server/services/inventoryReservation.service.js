const InventoryReservation = require('../models/inventoryReservation.model');
const Product = require('../models/product');

class InventoryReservationService {
    // Reservation duration - 15 minutes
    static RESERVATION_DURATION_MS = 15 * 60 * 1000;

    /**
     * Reserve stock for a product
     */
    static async reserveStock(productId, userId, quantity, sessionId = null) {
        try {
            // Validate product exists
            const product = await Product.findById(productId);
            if (!product) {
                throw new Error('Product not found');
            }

            // Check if stock is available after accounting for other reservations
            const availableStock = await this.getAvailableStock(productId);
            
            if (availableStock < quantity) {
                throw new Error(`Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`);
            }

            // Create reservation
            const expiresAt = new Date(Date.now() + this.RESERVATION_DURATION_MS);

            const reservation = new InventoryReservation({
                product: productId,
                user: userId || null,
                quantity,
                status: 'reserved',
                expiresAt,
                sessionId: sessionId || null
            });

            await reservation.save();
            return reservation;
        } catch (error) {
            console.error('Error reserving stock:', error);
            throw error;
        }
    }

    /**
     * Get available stock after accounting for active reservations
     */
    static async getAvailableStock(productId) {
        try {
            const product = await Product.findById(productId);
            if (!product) {
                throw new Error('Product not found');
            }

            // Get all active (non-expired) reservations
            const reservedQuantity = await InventoryReservation.aggregate([
                {
                    $match: {
                        product: product._id,
                        status: { $in: ['reserved', 'confirmed'] },
                        expiresAt: { $gt: new Date() }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$quantity' }
                    }
                }
            ]);

            const reserved = reservedQuantity.length > 0 ? reservedQuantity[0].total : 0;
            const available = product.stock - reserved;

            return Math.max(0, available);
        } catch (error) {
            console.error('Error getting available stock:', error);
            throw error;
        }
    }

    /**
     * Confirm a reservation (convert to order)
     */
    static async confirmReservation(reservationId, orderId, orderItemId = null) {
        try {
            const reservation = await InventoryReservation.findByIdAndUpdate(
                reservationId,
                {
                    status: 'confirmed',
                    order: orderId,
                    orderItem: orderItemId,
                    confirmedAt: new Date()
                },
                { new: true }
            );

            if (!reservation) {
                throw new Error('Reservation not found');
            }

            return reservation;
        } catch (error) {
            console.error('Error confirming reservation:', error);
            throw error;
        }
    }

    /**
     * Release a reservation (user cancels, checkout times out, etc)
     */
    static async releaseReservation(reservationId, reason = 'cancelled_by_user') {
        try {
            const reservation = await InventoryReservation.findByIdAndUpdate(
                reservationId,
                {
                    status: 'released',
                    releasedAt: new Date(),
                    releaseReason: reason
                },
                { new: true }
            );

            if (!reservation) {
                throw new Error('Reservation not found');
            }

            return reservation;
        } catch (error) {
            console.error('Error releasing reservation:', error);
            throw error;
        }
    }

    /**
     * Release all expired reservations
     */
    static async releaseExpiredReservations() {
        try {
            const now = new Date();
            
            const result = await InventoryReservation.updateMany(
                {
                    status: 'reserved',
                    expiresAt: { $lt: now }
                },
                {
                    status: 'expired',
                    releasedAt: now,
                    releaseReason: 'expired'
                }
            );

            console.log(`Released ${result.modifiedCount} expired reservations`);
            return result;
        } catch (error) {
            console.error('Error releasing expired reservations:', error);
            throw error;
        }
    }

    /**
     * Get user's active reservations
     */
    static async getUserReservations(userId) {
        try {
            const reservations = await InventoryReservation.find({
                user: userId,
                status: { $in: ['reserved', 'confirmed'] },
                expiresAt: { $gt: new Date() }
            })
                .populate('product', 'name price sku stock')
                .lean();

            return reservations;
        } catch (error) {
            console.error('Error getting user reservations:', error);
            throw error;
        }
    }

    /**
     * Get reservations for an order
     */
    static async getOrderReservations(orderId) {
        try {
            const reservations = await InventoryReservation.find({
                order: orderId
            })
                .populate('product', 'name price sku stock')
                .populate('orderItem')
                .lean();

            return reservations;
        } catch (error) {
            console.error('Error getting order reservations:', error);
            throw error;
        }
    }

    /**
     * Check if product has sufficient stock for quantity
     */
    static async checkStockAvailability(productId, quantity) {
        try {
            const availableStock = await this.getAvailableStock(productId);
            return availableStock >= quantity;
        } catch (error) {
            console.error('Error checking stock availability:', error);
            throw error;
        }
    }

    /**
     * Get stock summary for a product
     */
    static async getStockSummary(productId) {
        try {
            const product = await Product.findById(productId);
            if (!product) {
                throw new Error('Product not found');
            }

            // Get active reservations
            const reservedQuantity = await InventoryReservation.aggregate([
                {
                    $match: {
                        product: product._id,
                        status: { $in: ['reserved', 'confirmed'] },
                        expiresAt: { $gt: new Date() }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$quantity' }
                    }
                }
            ]);

            const reserved = reservedQuantity.length > 0 ? reservedQuantity[0].total : 0;
            const available = product.stock - reserved;

            return {
                totalStock: product.stock,
                reserved,
                available: Math.max(0, available),
                reservationCount: await InventoryReservation.countDocuments({
                    product: productId,
                    status: { $in: ['reserved', 'confirmed'] },
                    expiresAt: { $gt: new Date() }
                })
            };
        } catch (error) {
            console.error('Error getting stock summary:', error);
            throw error;
        }
    }

    /**
     * Release all reservations for a user (on logout, cart clear, etc)
     */
    static async releaseUserReservations(userId, reason = 'cancelled_by_user') {
        try {
            const result = await InventoryReservation.updateMany(
                {
                    user: userId,
                    status: 'reserved'
                },
                {
                    status: 'released',
                    releasedAt: new Date(),
                    releaseReason: reason
                }
            );

            return result;
        } catch (error) {
            console.error('Error releasing user reservations:', error);
            throw error;
        }
    }

    /**
     * Deduct stock on order completion (after confirmed)
     * This should be called when order is confirmed and payment is successful
     */
    static async deductStock(productId, quantity) {
        try {
            const result = await Product.findByIdAndUpdate(
                productId,
                { $inc: { stock: -quantity } },
                { new: true }
            );

            if (!result) {
                throw new Error('Product not found');
            }

            if (result.stock < 0) {
                throw new Error('Stock went negative - data integrity error');
            }

            return result;
        } catch (error) {
            console.error('Error deducting stock:', error);
            throw error;
        }
    }

    /**
     * Bulk deduct stock for multiple items
     */
    static async deductBulkStock(items) {
        try {
            // items should be array of { productId, quantity }
            const promises = items.map(item =>
                this.deductStock(item.productId, item.quantity)
            );

            const results = await Promise.all(promises);
            return results;
        } catch (error) {
            console.error('Error deducting bulk stock:', error);
            throw error;
        }
    }

    /**
     * Restore stock on order cancellation or refund
     */
    static async restoreStock(productId, quantity) {
        try {
            const result = await Product.findByIdAndUpdate(
                productId,
                { $inc: { stock: quantity } },
                { new: true }
            );

            if (!result) {
                throw new Error('Product not found');
            }

            return result;
        } catch (error) {
            console.error('Error restoring stock:', error);
            throw error;
        }
    }
}

module.exports = InventoryReservationService;
