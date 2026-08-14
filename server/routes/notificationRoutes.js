const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken } = require('../middleware/authMiddleware');

// Get all notifications for authenticated user
router.get('/', verifyToken, notificationController.getNotifications);

// Get unread notification count
router.get('/unread/count', verifyToken, notificationController.getUnreadCount);

// Mark specific notification as read
router.put('/:notificationId/read', verifyToken, notificationController.markAsRead);

// Mark all notifications as read
router.put('/read/all', verifyToken, notificationController.markAllAsRead);

// Delete specific notification
router.delete('/:notificationId', verifyToken, notificationController.deleteNotification);

// Delete all notifications
router.delete('/', verifyToken, notificationController.deleteAllNotifications);

module.exports = router;
