const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// Public: Get all categories (for the menu)
router.get('/', categoryController.getCategories);

// Private: Create category (Only You)
router.post('/', verifyToken, isSuperAdmin, categoryController.addCategory);

module.exports = router;