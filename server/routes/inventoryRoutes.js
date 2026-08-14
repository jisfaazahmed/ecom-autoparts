const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { verifyToken } = require('../middleware/authMiddleware');
const {
	validateInventoryCheck,
	validateObjectIdParam,
} = require('../middleware/requestValidators');

// Check stock availability
router.post('/check-availability', validateInventoryCheck, inventoryController.checkStockAvailability);

// Get stock summary for a product
router.get('/summary/:productId', validateObjectIdParam('productId', 'productId'), inventoryController.getStockSummary);

// Get available stock for a product
router.get('/available/:productId', validateObjectIdParam('productId', 'productId'), inventoryController.getAvailableStock);

// Release expired reservations (admin)
router.post('/release-expired', verifyToken, inventoryController.releaseExpiredReservations);

// Get reservations for a product (admin)
router.get('/reservations/:productId', verifyToken, validateObjectIdParam('productId', 'productId'), inventoryController.getProductReservations);

module.exports = router;
