const Notification = require('../models/notification.model');
const User = require('../models/user');
const emailService = require('./email.service');

class NotificationService {
    static async createNotification(userId, type, data) {
        try {
            // Get user to check preferences
            const user = await User.findById(userId);
            if (!user) return null;

            const category = this._getCategoryFromType(type);
            const prefs = user.notificationPreferences?.[category] || { inApp: true, email: true };

            const notificationTemplates = {
                order_placed: {
                    title: 'Order Placed Successfully',
                    message: (data) => `Your order #${data.orderNumber} has been placed successfully!`,
                    priority: 'normal',
                    emailFunc: 'sendOrderConfirmation'
                },
                // ... other templates ...
                order_shipped: {
                    title: 'Order Shipped',
                    message: (data) => `Your order #${data.orderNumber} has been shipped! Tracking #${data.trackingNumber} via ${data.courierPartner}`,
                    priority: 'high',
                    emailFunc: 'sendOrderShipped'
                },
                // ... 
            };

            // Implementation note: I will refactor the whole createNotification to be more robust
            // but for now let's just make it check preferences.

            let notification = null;
            if (prefs.inApp) {
                const template = this._getTemplate(type, data);
                notification = new Notification({
                    user: userId,
                    type,
                    order: data.orderId,
                    refund: data.refundId,
                    title: template.title,
                    message: template.message,
                    data,
                    priority: template.priority,
                    channel: 'in_app'
                });
                await notification.save();
            }

            if (prefs.email && user.email) {
                const template = this._getTemplate(type, data);
                if (template.emailFunc && emailService[template.emailFunc]) {
                    await emailService[template.emailFunc](user.email, data);
                }
            }

            return notification;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    static _getCategoryFromType(type) {
        if (type.startsWith('order_') || type.startsWith('refund_') || type.startsWith('payment_')) return 'orderUpdates';
        if (type.startsWith('promo_')) return 'promotions';
        if (type.startsWith('security_') || type === 'login_alert') return 'security';
        return 'orderUpdates';
    }

    static _getTemplate(type, data) {
        const templates = {
            order_placed: {
                title: 'Order Placed Successfully',
                message: `Your order #${data.orderNumber} has been placed successfully!`,
                priority: 'normal',
                emailFunc: 'sendOrderConfirmation'
            },
            order_confirmed: {
                title: 'Order Confirmed',
                message: `Order #${data.orderNumber} has been confirmed by the seller.`,
                priority: 'normal'
            },
            order_shipped: {
                title: 'Order Shipped',
                message: `Your order #${data.orderNumber} has been shipped! Tracking #${data.trackingNumber} via ${data.courierPartner}`,
                priority: 'high',
                emailFunc: 'sendOrderShipped'
            },
            order_delivered: {
                title: 'Order Delivered',
                message: `Your order #${data.orderNumber} has been delivered successfully!`,
                priority: 'high'
            },
            refund_initiated: {
                title: 'Refund Initiated',
                message: `Refund of ₹${data.refundAmount} initiated for order #${data.orderNumber}.`,
                priority: 'high'
            },
            refund_completed: {
                title: 'Refund Completed',
                message: `Refund of ₹${data.refundAmount} completed for order #${data.orderNumber}.`,
                priority: 'high'
            },
            payment_failed: {
                title: 'Payment Failed',
                message: `Payment failed for order #${data.orderNumber}.`,
                priority: 'high'
            },
            payment_success: {
                title: 'Payment Successful',
                message: `Payment of ₹${data.paymentAmount} received for order #${data.orderNumber}.`,
                priority: 'high'
            }
        };
        return templates[type] || { title: 'Notification', message: 'New update', priority: 'normal' };
    }

    static async getUserNotifications(userId, page = 1, limit = 10, filters = {}) {
        try {
            const query = { user: userId };
            if (filters.type) query.type = filters.type;
            if (filters.isRead !== undefined) query.isRead = filters.isRead;
            if (filters.priority) query.priority = filters.priority;

            const notifications = await Notification.find(query)
                .populate('order', 'orderNumber')
                .populate('refund', 'refundNumber')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean();

            const total = await Notification.countDocuments(query);

            return {
                notifications,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            };
        } catch (error) {
            console.error('Error fetching notifications:', error);
            throw error;
        }
    }

    static async markAsRead(notificationId, userId) {
        try {
            const notification = await Notification.findOneAndUpdate(
                { _id: notificationId, user: userId },
                { isRead: true, readAt: new Date() },
                { new: true }
            );

            if (!notification) {
                throw new Error('Notification not found');
            }

            return notification;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            throw error;
        }
    }

    static async markAllAsRead(userId) {
        try {
            const result = await Notification.updateMany(
                { user: userId, isRead: false },
                { isRead: true, readAt: new Date() }
            );
            return result;
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
            throw error;
        }
    }

    static async getUnreadCount(userId) {
        try {
            const count = await Notification.countDocuments({
                user: userId,
                isRead: false
            });
            return count;
        } catch (error) {
            console.error('Error getting unread count:', error);
            throw error;
        }
    }

    static async deleteNotification(notificationId, userId) {
        try {
            const result = await Notification.findOneAndDelete({
                _id: notificationId,
                user: userId
            });

            if (!result) {
                throw new Error('Notification not found');
            }

            return result;
        } catch (error) {
            console.error('Error deleting notification:', error);
            throw error;
        }
    }

    static async deleteAllNotifications(userId) {
        try {
            const result = await Notification.deleteMany({ user: userId });
            return result;
        } catch (error) {
            console.error('Error deleting all notifications:', error);
            throw error;
        }
    }

    static async notifyOrderCreated(order) {
        try {
            if (!order.user) return;
            await this.createNotification(order.user, 'order_placed', {
                orderId: order._id,
                orderNumber: order.orderNumber
            });
        } catch (error) {
            console.error('Error notifying order created:', error);
        }
    }

    static async notifyOrderConfirmed(order) {
        try {
            if (!order.user) return;
            await this.createNotification(order.user, 'order_confirmed', {
                orderId: order._id,
                orderNumber: order.orderNumber
            });
        } catch (error) {
            console.error('Error notifying order confirmed:', error);
        }
    }

    static async notifyOrderShipped(order, trackingNumber, courierPartner) {
        try {
            if (!order.user) return;
            await this.createNotification(order.user, 'order_shipped', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                trackingNumber,
                courierPartner
            });
        } catch (error) {
            console.error('Error notifying order shipped:', error);
        }
    }

    static async notifyOrderDelivered(order) {
        try {
            if (!order.user) return;
            await this.createNotification(order.user, 'order_delivered', {
                orderId: order._id,
                orderNumber: order.orderNumber
            });
        } catch (error) {
            console.error('Error notifying order delivered:', error);
        }
    }

    static async notifyRefundInitiated(order, refund, refundAmount) {
        try {
            if (!order.user) return;
            await this.createNotification(order.user, 'refund_initiated', {
                orderId: order._id,
                refundId: refund._id,
                orderNumber: order.orderNumber,
                refundAmount
            });
        } catch (error) {
            console.error('Error notifying refund initiated:', error);
        }
    }

    static async notifyRefundCompleted(order, refund, refundAmount) {
        try {
            if (!order.user) return;
            await this.createNotification(order.user, 'refund_completed', {
                orderId: order._id,
                refundId: refund._id,
                orderNumber: order.orderNumber,
                refundAmount
            });
        } catch (error) {
            console.error('Error notifying refund completed:', error);
        }
    }

    static async notifyPaymentFailed(order) {
        try {
            if (!order.user) return;
            await this.createNotification(order.user, 'payment_failed', {
                orderId: order._id,
                orderNumber: order.orderNumber
            });
        } catch (error) {
            console.error('Error notifying payment failed:', error);
        }
    }

    static async notifyPaymentSuccess(order, paymentAmount) {
        try {
            if (!order.user) return;
            await this.createNotification(order.user, 'payment_success', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                paymentAmount
            });
        } catch (error) {
            console.error('Error notifying payment success:', error);
        }
    }
}

module.exports = NotificationService;
