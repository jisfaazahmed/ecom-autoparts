const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyToken, isSuperAdmin, attachUserIfPresent } = require('../middleware/authMiddleware');

// Public: Search for parts (The User Flow)
router.post('/check-stock', productController.checkStock);
router.get('/', attachUserIfPresent, productController.getProducts);
router.get('/admin/all', verifyToken, isSuperAdmin, productController.getSuperAdminProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/categories', productController.getCategories);
router.get('/:id/reviews', productController.getProductReviews);
router.post('/:id/reviews', verifyToken, productController.createProductReview);
router.put('/:id/reviews/:reviewId', verifyToken, productController.updateProductReview);
router.delete('/:id/reviews/:reviewId', verifyToken, productController.deleteProductReview);
router.get('/:id', attachUserIfPresent, productController.getProductById);

// Private: Create generic parts (Sellers & Admins)
router.post('/', verifyToken, productController.createProduct);
router.put('/:id', verifyToken, productController.updateProduct);
router.delete('/:id', verifyToken, productController.deleteProduct);

// Super Admin: Approve / Reject product
router.put('/:id/status', verifyToken, isSuperAdmin, productController.updateProductStatus);
router.put('/:id/featured', verifyToken, isSuperAdmin, productController.updateProductFeatured);

module.exports = router;