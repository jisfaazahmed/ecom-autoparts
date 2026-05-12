const Notification = require('../models/notification.model');
const User = require('../models/user');
const emailService = require('./email.service');

class NotificationService {
    static async createNotification(userId, type, data) {
        try {
            // Handle Admin-wide notifications (for Super Admins)
            if (type.startsWith('admin_') && !userId) {
                const superAdmins = await User.find({ role: 'SUPER_ADMIN' });
                const notifications = [];
                
                for (const admin of superAdmins) {
                    const result = await this.createNotification(admin._id, type, data);
                    if (result) notifications.push(result);
                }
                
                // Also send a direct email to the configured ADMIN_EMAIL if it's different
                const configAdminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || process.env.EMAIL_USER || process.env.SUPER_ADMIN_EMAIL;
                if (configAdminEmail && !superAdmins.some(a => a.email === configAdminEmail)) {
                    const template = this._getTemplate(type, data);
                    if (template.emailFunc && emailService[template.emailFunc]) {
                        await emailService[template.emailFunc](configAdminEmail, data);
                    }
                }
                
                return notifications[0] || null;
            }

            // Get user to check preferences
            const user = await User.findById(userId);
            if (!user) return null;

            const category = this._getCategoryFromType(type);
            const prefs = user.notificationPreferences?.[category] || { inApp: true, email: true };
            const template = this._getTemplate(type, data);

            let notification = null;
            if (prefs.inApp) {
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
        if (type.startsWith('order_') || type.startsWith('refund_') || type.startsWith('payment_') || type.startsWith('vendor_')) return 'orderUpdates';
        if (type.startsWith('promo_')) return 'promotions';
        if (type.startsWith('security_') || type === 'login_alert' || type.startsWith('admin_')) return 'security';
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
                priority: 'normal',
                emailFunc: 'sendOrderConfirmed'
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
                priority: 'high',
                emailFunc: 'sendOrderDelivered'
            },
            order_processing: {
                title: 'Order Being Packed',
                message: `Good news! Your order #${data.orderNumber} is being packed and prepared for shipping.`,
                priority: 'normal',
                emailFunc: 'sendOrderProcessing'
            },
            order_out_for_delivery: {
                title: 'Order Out for Delivery',
                message: `Your order #${data.orderNumber} is out for delivery and will reach you soon!`,
                priority: 'high',
                emailFunc: 'sendOrderOutForDelivery'
            },
            vendor_order_delivered: {
                title: 'Order Delivered to Customer',
                message: `Order #${data.orderNumber} has been successfully delivered to the customer.`,
                priority: 'normal',
                emailFunc: 'sendVendorOrderDelivered'
            },
            vendor_order_alert: {
                title: 'New Order Received',
                message: `You have received a new order #${data.orderNumber}. Please review and approve it.`,
                priority: 'high',
                emailFunc: 'sendVendorOrderAlert'
            },
            admin_vendor_applied: {
                title: 'New Vendor Application',
                message: `A new vendor "${data.vendorName}" has applied. Email: ${data.vendorEmail}`,
                priority: 'high',
                emailFunc: 'sendAdminVendorAppliedAlert'
            },
            admin_product_added: {
                title: 'New Product for Approval',
                message: `Vendor "${data.vendorName}" added a new product: ${data.productName}`,
                priority: 'normal',
                emailFunc: 'sendAdminProductAddedAlert'
            },
            admin_customer_signup: {
                title: 'New Customer Signup',
                message: `A new customer has signed up: ${data.customerName} (${data.customerEmail})`,
                priority: 'low',
                emailFunc: 'sendAdminCustomerSignupAlert'
            },
            admin_coupon_used: {
                title: 'Coupon Used',
                message: `Coupon "${data.couponCode}" was used in order #${data.orderNumber} for a discount of Rs.${data.discountAmount}`,
                priority: 'normal',
                emailFunc: 'sendAdminCouponUsedAlert'
            },
            vendor_application_approved: {
                title: 'Vendor Application Approved!',
                message: `Congratulations! Your vendor application for "${data.shopName}" has been approved. You can now start adding products.`,
                priority: 'high',
                emailFunc: 'sendVendorApplicationApproved'
            },
            vendor_application_rejected: {
                title: 'Vendor Application Update',
                message: `We regret to inform you that your vendor application for "${data.shopName}" was not approved at this time.`,
                priority: 'high',
                emailFunc: 'sendVendorApplicationRejected'
            },
            refund_initiated: {
                title: 'Refund Initiated',
                message: `Refund of Rs.${data.refundAmount} initiated for order #${data.orderNumber}.`,
                priority: 'high'
            },
            refund_completed: {
                title: 'Refund Completed',
                message: `Refund of Rs.${data.refundAmount} completed for order #${data.orderNumber}.`,
                priority: 'high'
            },
            payment_failed: {
                title: 'Payment Failed',
                message: `Payment failed for order #${data.orderNumber}.`,
                priority: 'high'
            },
            payment_success: {
                title: 'Payment Successful',
                message: `Payment of Rs.${data.paymentAmount} received for order #${data.orderNumber}.`,
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
            // Notify customer
            if (order.user) {
                await this.createNotification(order.user, 'order_placed', {
                    orderId: order._id,
                    orderNumber: order.orderNumber,
                    itemsTotal: order.itemsTotal,
                    totalAmount: order.totalAmount
                });
            }

            // Notify vendors
            // We need to find distinct vendors from the subOrders
            if (order.subOrders && order.subOrders.length > 0) {
                for (const subOrder of order.subOrders) {
                    const vendorId = subOrder.vendor || subOrder.seller;
                    if (vendorId) {
                        await this.notifyVendorOrder(order, vendorId);
                    }
                }
            }
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
            // Notify Customer
            if (order.user) {
                await this.createNotification(order.user, 'order_delivered', {
                    orderId: order._id,
                    orderNumber: order.orderNumber
                });
            }

            // Notify Vendors
            if (order.subOrders && order.subOrders.length > 0) {
                for (const subOrder of order.subOrders) {
                    const vendorId = subOrder.vendor || subOrder.seller;
                    if (vendorId) {
                        await this.notifyVendorOrderDelivered(order, vendorId);
                    }
                }
            }
        } catch (error) {
            console.error('Error notifying order delivered:', error);
        }
    }

    static async notifyOrderProcessing(order) {
        try {
            if (!order.user) return;
            await this.createNotification(order.user, 'order_processing', {
                orderId: order._id,
                orderNumber: order.orderNumber
            });
        } catch (error) {
            console.error('Error notifying order processing:', error);
        }
    }

    static async notifyOrderOutForDelivery(order) {
        try {
            if (!order.user) return;
            await this.createNotification(order.user, 'order_out_for_delivery', {
                orderId: order._id,
                orderNumber: order.orderNumber
            });
        } catch (error) {
            console.error('Error notifying order out for delivery:', error);
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

    static async notifyVendorOrder(order, vendorId) {
        try {
            await this.createNotification(vendorId, 'vendor_order_alert', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                customerName: order.shippingAddress?.fullName || 'Customer'
            });
        } catch (error) {
            console.error('Error notifying vendor order:', error);
        }
    }

    static async notifyVendorOrderDelivered(order, vendorId) {
        try {
            await this.createNotification(vendorId, 'vendor_order_delivered', {
                orderId: order._id,
                orderNumber: order.orderNumber
            });
        } catch (error) {
            console.error('Error notifying vendor order delivered:', error);
        }
    }

    static async notifySuperAdminVendorApplied(vendor) {
        try {
            await this.createNotification(null, 'admin_vendor_applied', {
                vendorName: vendor.name,
                vendorEmail: vendor.email
            });
        } catch (error) {
            console.error('Error notifying super admin vendor applied:', error);
        }
    }

    static async notifySuperAdminProductAdded(product, vendor) {
        try {
            await this.createNotification(null, 'admin_product_added', {
                productName: product.name,
                vendorName: vendor.name,
                productId: product._id
            });
        } catch (error) {
            console.error('Error notifying super admin product added:', error);
        }
    }

    static async notifySuperAdminCustomerSignup(customer) {
        try {
            await this.createNotification(null, 'admin_customer_signup', {
                customerName: customer.name,
                customerEmail: customer.email
            });
        } catch (error) {
            console.error('Error notifying super admin customer signup:', error);
        }
    }

    static async notifySuperAdminCouponUsed(order) {
        try {
            await this.createNotification(null, 'admin_coupon_used', {
                orderId: order._id,
                orderNumber: order.orderNumber,
                couponCode: order.couponCode,
                discountAmount: order.couponDiscount || order.discountAmount || 0
            });
        } catch (error) {
            console.error('Error notifying super admin coupon used:', error);
        }
    }

    static async notifyVendorApplicationResult(vendor, status) {
        try {
            const type = status === 'ACTIVE' ? 'vendor_application_approved' : 'vendor_application_rejected';
            await this.createNotification(vendor._id, type, {
                shopName: vendor.shopName || vendor.name
            });
        } catch (error) {
            console.error('Error notifying vendor application result:', error);
        }
    }
}

module.exports = NotificationService;
