const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const reviewController = require('../controllers/reviewController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// Public: Search for parts (The User Flow)
router.get('/', productController.getProducts);
router.get('/featured', productController.getFeaturedProducts);
router.get('/categories', productController.getCategories);
router.get('/:productId/reviews', reviewController.getProductReviews);
router.post('/:productId/reviews', verifyToken, reviewController.createProductReview);
router.put('/:productId/reviews/:reviewId', verifyToken, reviewController.updateProductReview);
router.delete('/:productId/reviews/:reviewId', verifyToken, reviewController.deleteProductReview);
router.get('/:id', productController.getProductById);

// Private: Create generic parts (Super Admin Only)
router.post('/', verifyToken, isSuperAdmin, productController.createProduct);

module.exports = router;