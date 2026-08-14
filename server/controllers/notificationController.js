const NotificationService = require('../services/notification.service');

module.exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { page = 1, limit = 10, type, isRead, priority } = req.query;

        const filters = {};
        if (type) filters.type = type;
        if (isRead !== undefined) filters.isRead = isRead === 'true';
        if (priority) filters.priority = priority;

        const result = await NotificationService.getUserNotifications(
            userId,
            parseInt(page),
            parseInt(limit),
            filters
        );

        res.status(200).json({
            success: true,
            data: result,
            message: 'Notifications retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get notifications'
        });
    }
};

module.exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const count = await NotificationService.getUnreadCount(userId);

        res.status(200).json({
            success: true,
            unreadCount: count,
            message: 'Unread count retrieved successfully'
        });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get unread count'
        });
    }
};

module.exports.markAsRead = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { notificationId } = req.params;

        const notification = await NotificationService.markAsRead(notificationId, userId);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(200).json({
            success: true,
            data: notification,
            message: 'Notification marked as read'
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to mark notification as read'
        });
    }
};

module.exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const result = await NotificationService.markAllAsRead(userId);

        res.status(200).json({
            success: true,
            data: result,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Error marking all as read:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to mark all notifications as read'
        });
    }
};

module.exports.deleteNotification = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { notificationId } = req.params;

        const notification = await NotificationService.deleteNotification(notificationId, userId);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete notification'
        });
    }
};

module.exports.deleteAllNotifications = async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const result = await NotificationService.deleteAllNotifications(userId);

        res.status(200).json({
            success: true,
            data: result,
            message: 'All notifications deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting all notifications:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete all notifications'
        });
    }
};
