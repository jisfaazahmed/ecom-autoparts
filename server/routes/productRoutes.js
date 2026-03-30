const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// Public: Search for parts (The User Flow)
router.post('/check-stock', productController.checkStock);
router.get('/', productController.getProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/categories', productController.getCategories);
router.get('/:id', productController.getProductById);

// Private: Create generic parts (Super Admin Only)
router.post('/', verifyToken, isSuperAdmin, productController.createProduct);

module.exports = router;