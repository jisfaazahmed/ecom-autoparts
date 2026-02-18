// ============================================
// Notification Controller - HTTP Handlers
// ============================================

import NotificationService from '../services/notification.service.js';
import ApiResponse from '../utils/response.js';
import logger from '../utils/logger.js';

class NotificationController {
    /**
     * POST /api/notifications
     * Create and send a notification.
     */
    static async create(req, res, next) {
        try {
            const notification = await NotificationService.createNotification(req.body);
            logger.info(`Notification created: ${notification.id}`);
            return ApiResponse.success(res, 201, 'Notification created and dispatched', notification.toJSON());
        } catch (error) {
            if (error.statusCode) {
                return ApiResponse.error(res, error.statusCode, error.message, error.errors || []);
            }
            next(error);
        }
    }

    /**
     * GET /api/notifications
     * List notifications with optional filters.
     */
    static async getAll(req, res, next) {
        try {
            const filters = {
                userId: req.query.userId,
                type: req.query.type,
                status: req.query.status,
                channel: req.query.channel,
                read: req.query.read,
            };
            const notifications = NotificationService.getNotifications(filters);
            return ApiResponse.success(res, 200, 'Notifications retrieved', notifications);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/notifications/stats
     * Get notification statistics.
     */
    static async getStats(req, res, next) {
        try {
            const stats = NotificationService.getStatistics();
            return ApiResponse.success(res, 200, 'Statistics retrieved', stats);
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/notifications/:id
     * Get a notification by ID.
     */
    static async getById(req, res, next) {
        try {
            const notification = NotificationService.getNotificationById(req.params.id);
            if (!notification) {
                return ApiResponse.error(res, 404, 'Notification not found');
            }
            return ApiResponse.success(res, 200, 'Notification retrieved', notification);
        } catch (error) {
            next(error);
        }
    }

    /**
     * PUT /api/notifications/:id/read
     * Mark a notification as read.
     */
    static async markAsRead(req, res, next) {
        try {
            const notification = NotificationService.markAsRead(req.params.id);
            if (!notification) {
                return ApiResponse.error(res, 404, 'Notification not found');
            }
            return ApiResponse.success(res, 200, 'Notification marked as read', notification);
        } catch (error) {
            next(error);
        }
    }

    /**
     * PUT /api/notifications/read-multiple
     * Bulk mark notifications as read.
     */
    static async markMultipleAsRead(req, res, next) {
        try {
            const { ids } = req.body;
            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return ApiResponse.error(res, 400, 'ids must be a non-empty array');
            }
            const result = NotificationService.markMultipleAsRead(ids);
            return ApiResponse.success(res, 200, 'Notifications updated', result);
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/notifications/:id/retry
     * Retry a failed notification.
     */
    static async retry(req, res, next) {
        try {
            const notification = await NotificationService.retryNotification(req.params.id);
            if (!notification) {
                return ApiResponse.error(res, 404, 'Notification not found');
            }
            return ApiResponse.success(res, 200, 'Notification retried', notification);
        } catch (error) {
            if (error.statusCode) {
                return ApiResponse.error(res, error.statusCode, error.message);
            }
            next(error);
        }
    }

    /**
     * DELETE /api/notifications/:id
     * Delete a notification.
     */
    static async delete(req, res, next) {
        try {
            const deleted = NotificationService.deleteNotification(req.params.id);
            if (!deleted) {
                return ApiResponse.error(res, 404, 'Notification not found');
            }
            return ApiResponse.success(res, 200, 'Notification deleted');
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/notifications/vendor-approval
     * Helper: Send vendor approval/rejection notification.
     */
    static async vendorApproval(req, res, next) {
        try {
            const { vendor, approved, adminId } = req.body;

            if (!vendor || !vendor.id) {
                return ApiResponse.error(res, 400, 'vendor object with id is required');
            }
            if (approved === undefined) {
                return ApiResponse.error(res, 400, 'approved field is required');
            }
            if (!adminId) {
                return ApiResponse.error(res, 400, 'adminId is required');
            }

            const notification = await NotificationService.sendVendorNotification(vendor, approved, adminId);
            return ApiResponse.success(res, 201, `Vendor ${approved ? 'approval' : 'rejection'} notification sent`, notification.toJSON());
        } catch (error) {
            if (error.statusCode) {
                return ApiResponse.error(res, error.statusCode, error.message, error.errors || []);
            }
            next(error);
        }
    }

    /**
     * POST /api/notifications/order-confirmation
     * Helper: Send order confirmation notification.
     */
    static async orderConfirmation(req, res, next) {
        try {
            const { order, customer } = req.body;

            if (!order || !order.id) {
                return ApiResponse.error(res, 400, 'order object with id is required');
            }
            if (!customer || !customer.id) {
                return ApiResponse.error(res, 400, 'customer object with id is required');
            }

            const notification = await NotificationService.sendOrderConfirmation(order, customer);
            return ApiResponse.success(res, 201, 'Order confirmation notification sent', notification.toJSON());
        } catch (error) {
            if (error.statusCode) {
                return ApiResponse.error(res, error.statusCode, error.message, error.errors || []);
            }
            next(error);
        }
    }
}

export default NotificationController;
