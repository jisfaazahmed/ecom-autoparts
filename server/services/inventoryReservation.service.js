const InventoryReservation = require('../models/inventoryReservation.model');
const Product = require('../models/product');

class InventoryReservationService {
    // Reservation duration defaults to 15 minutes (configurable via env).
    static RESERVATION_DURATION_MS = Math.max(
        1,
        Number(process.env.INVENTORY_RESERVATION_MINUTES || 15)
    ) * 60 * 1000;

    /**
     * Mark expired reservations for a product as expired so stock views stay current.
     */
    static async sweepExpiredReservationsForProduct(productId) {
        const now = new Date();
        await InventoryReservation.updateMany(
            {
                product: productId,
                status: 'reserved',
                expiresAt: { $lte: now }
            },
            {
                status: 'expired',
                releasedAt: now,
                releaseReason: 'expired'
            }
        );
    }

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

            await this.sweepExpiredReservationsForProduct(product._id);

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
     * Get available stock for a specific user by adding back their own active reserved quantity.
     */
    static async getAvailableStockForUser(productId, userId) {
        try {
            const [availableStock, ownReserved] = await Promise.all([
                this.getAvailableStock(productId),
                this.getUserProductReservedQuantity(userId, productId),
            ]);

            return Math.max(0, availableStock + ownReserved);
        } catch (error) {
            console.error('Error getting user-aware available stock:', error);
            throw error;
        }
    }

    /**
     * Get active reserved quantity for a user's specific product.
     */
    static async getUserProductReservedQuantity(userId, productId) {
        try {
            if (!userId || !productId) return 0;

            const result = await InventoryReservation.aggregate([
                {
                    $match: {
                        user: userId,
                        product: productId,
                        status: 'reserved',
                        expiresAt: { $gt: new Date() },
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$quantity' }
                    }
                }
            ]);

            return result.length > 0 ? Number(result[0].total || 0) : 0;
        } catch (error) {
            console.error('Error getting user product reserved quantity:', error);
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
     * Create or update active reservation for a user-product pair.
     */
    static async upsertUserReservation(productId, userId, quantity, sessionId = null, cartId = null) {
        try {
            if (!userId) {
                throw new Error('User is required for inventory reservation');
            }

            const requestedQuantity = Number(quantity || 0);
            if (!Number.isFinite(requestedQuantity) || requestedQuantity < 1) {
                throw new Error('Reservation quantity must be at least 1');
            }

            const availableForUser = await this.getAvailableStockForUser(productId, userId);
            if (availableForUser < requestedQuantity) {
                throw new Error(`Insufficient stock. Available: ${availableForUser}, Requested: ${requestedQuantity}`);
            }

            const now = new Date();
            const expiresAt = new Date(now.getTime() + this.RESERVATION_DURATION_MS);

            // Keep one active reservation document per user-product pair.
            return InventoryReservation.findOneAndUpdate(
                {
                    product: productId,
                    user: userId,
                    status: 'reserved',
                    expiresAt: { $gt: now }
                },
                {
                    $set: {
                        quantity: requestedQuantity,
                        expiresAt,
                        ...(sessionId ? { sessionId } : {}),
                        ...(cartId ? { cart: cartId } : {})
                    },
                    $setOnInsert: {
                        product: productId,
                        user: userId,
                        status: 'reserved',
                    }
                },
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true,
                }
            );
        } catch (error) {
            console.error('Error upserting user reservation:', error);
            throw error;
        }
    }

    /**
     * Release active reservations for a user-product pair.
     */
    static async releaseUserProductReservation(userId, productId, reason = 'cancelled_by_user') {
        try {
            if (!userId || !productId) {
                return { modifiedCount: 0, matchedCount: 0 };
            }

            return InventoryReservation.updateMany(
                {
                    user: userId,
                    product: productId,
                    status: 'reserved',
                    expiresAt: { $gt: new Date() }
                },
                {
                    status: 'released',
                    releasedAt: new Date(),
                    releaseReason: reason
                }
            );
        } catch (error) {
            console.error('Error releasing user product reservation:', error);
            throw error;
        }
    }

    /**
     * Release all active reservations for a user.
     */
    static async releaseUserReservations(userId, reason = 'cancelled_by_user') {
        try {
            if (!userId) {
                return { modifiedCount: 0, matchedCount: 0 };
            }

            return InventoryReservation.updateMany(
                {
                    user: userId,
                    status: 'reserved',
                    expiresAt: { $gt: new Date() }
                },
                {
                    status: 'released',
                    releasedAt: new Date(),
                    releaseReason: reason
                }
            );
        } catch (error) {
            console.error('Error releasing user reservations:', error);
            throw error;
        }
    }

    /**
     * Convert user's active reservation for a product to an order allocation.
     */
    static async convertUserReservationToOrder({ userId, productId, quantity, orderId, orderItemId = null }) {
        try {
            if (!userId || !productId || !orderId || !quantity) {
                return null;
            }

            const reservation = await InventoryReservation.findOne({
                user: userId,
                product: productId,
                status: 'reserved',
                expiresAt: { $gt: new Date() }
            }).sort({ createdAt: -1 });

            if (!reservation) {
                return null;
            }

            reservation.status = 'converted_to_order';
            reservation.order = orderId;
            reservation.orderItem = orderItemId;
            reservation.confirmedAt = new Date();
            reservation.expiresAt = new Date(Date.now() + (24 * 60 * 60 * 1000));
            reservation.quantity = Number(quantity);
            await reservation.save();
            return reservation;
        } catch (error) {
            console.error('Error converting reservation to order:', error);
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
     * Get active reservations for a product.
     */
    static async getProductReservations(productId) {
        try {
            return InventoryReservation.find({
                product: productId,
                status: { $in: ['reserved', 'confirmed', 'converted_to_order'] },
                expiresAt: { $gt: new Date() }
            })
                .populate('user', 'name email')
                .populate('order', 'orderNumber paymentStatus overallStatus')
                .sort({ createdAt: -1 })
                .lean();
        } catch (error) {
            console.error('Error getting product reservations:', error);
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
     * Atomically acquire stock for order placement to avoid oversell under races.
     */
    static async acquireStockForOrder(productId, quantity) {
        try {
            const requestedQuantity = Number(quantity || 0);
            if (!Number.isFinite(requestedQuantity) || requestedQuantity < 1) {
                throw new Error('Quantity must be at least 1');
            }

            const result = await Product.findOneAndUpdate(
                {
                    _id: productId,
                    stock: { $gte: requestedQuantity }
                },
                {
                    $inc: {
                        stock: -requestedQuantity,
                        soldCount: requestedQuantity,
                    }
                },
                {
                    new: true,
                }
            );

            if (!result) {
                throw new Error('stock not available');
            }

            return result;
        } catch (error) {
            console.error('Error acquiring stock for order:', error);
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
                { $inc: { stock: quantity, soldCount: -quantity } },
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
