const express = require('express');
const router = express.Router();
const vendorProductController = require('../controllers/vendorProductController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public: Get all prices for a specific product ID
router.get('/:productId', vendorProductController.getOffers);

// Private: Add an offer (Must be logged in)
// Note: In a real app, you'd add middleware to ensure role === 'ADMIN' (Vendor)
router.post('/', verifyToken, vendorProductController.addOffer);

module.exports = router;