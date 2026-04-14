const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyToken, isSuperAdmin, attachUserIfPresent } = require('../middleware/authMiddleware');

// Public: Search for parts (The User Flow)
router.post('/check-stock', productController.checkStock);
router.get('/', attachUserIfPresent, productController.getProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/categories', productController.getCategories);
router.get('/:id', productController.getProductById);

// Private: Create generic parts (Sellers & Admins)
router.post('/', verifyToken, productController.createProduct);

// Super Admin: Approve / Reject product
router.put('/:id/status', verifyToken, isSuperAdmin, productController.updateProductStatus);

module.exports = router;