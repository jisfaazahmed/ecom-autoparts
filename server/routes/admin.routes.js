const router = require('express').Router();
const statsController = require('../controllers/stats.controller');
const adminController = require('../controllers/admin.controller');

// Get Dashboard Stats
router.get('/stats', statsController.getDashboardStats);
router.get('/pending-users', adminController.getPendingUsers);
router.put('/update-status/:id', adminController.updateUserStatus);
router.get('/shops', adminController.getAllShops);      // <--- New
router.get('/users', adminController.getAllCustomers);  // <--- New

module.exports = router;