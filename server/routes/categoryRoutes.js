const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// Public: Get all categories (for the menu)
router.get('/', categoryController.getCategories);

// Private: Create / Update / Delete (Super Admin only)
router.post('/', verifyToken, isSuperAdmin, categoryController.addCategory);
router.put('/:id', verifyToken, isSuperAdmin, categoryController.updateCategory);
router.delete('/:id', verifyToken, isSuperAdmin, categoryController.deleteCategory);

module.exports = router;