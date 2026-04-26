const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { verifyToken } = require('../middleware/authMiddleware');

// Check stock availability
router.post('/check-availability', inventoryController.checkStockAvailability);

// Get stock summary for a product
router.get('/summary/:productId', inventoryController.getStockSummary);

// Get available stock for a product
router.get('/available/:productId', inventoryController.getAvailableStock);

// Release expired reservations (admin)
router.post('/release-expired', verifyToken, inventoryController.releaseExpiredReservations);

// Get reservations for a product (admin)
router.get('/reservations/:productId', verifyToken, inventoryController.getProductReservations);

module.exports = router;
