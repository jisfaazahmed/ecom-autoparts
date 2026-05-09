const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// Public: Get all categories (for the menu)
router.get('/', categoryController.getCategories);

<<<<<<< HEAD
// Private: Create category (Only You)
router.post('/', verifyToken, isSuperAdmin, categoryController.addCategory);
=======
// Private: Create / Update / Delete (Super Admin only)
router.post('/', verifyToken, isSuperAdmin, categoryController.addCategory);
router.put('/:id', verifyToken, isSuperAdmin, categoryController.updateCategory);
router.delete('/:id', verifyToken, isSuperAdmin, categoryController.deleteCategory);
>>>>>>> origin/feature/seller

module.exports = router;