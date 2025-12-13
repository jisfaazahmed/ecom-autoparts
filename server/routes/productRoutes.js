const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// Public: Search for parts (The User Flow)
router.get('/', productController.getProducts);

// Private: Create generic parts (Super Admin Only)
router.post('/', verifyToken, isSuperAdmin, productController.createProduct);

module.exports = router;