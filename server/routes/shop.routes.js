const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shop.controller');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// GET /api/shops - paginated list (superadmin)
router.get('/', verifyToken, isSuperAdmin, shopController.getShops);

// GET /api/shops/all - same as list (superadmin)
router.get('/all', verifyToken, isSuperAdmin, shopController.getAllShops);

// GET /api/shops/my - current user's shop (vendor only) - must be before /:id
router.get('/my', verifyToken, shopController.getMyShop);

// GET /api/shops/:id - single shop (superadmin only)
router.get('/:id', verifyToken, isSuperAdmin, shopController.getShopById);

// PUT /api/shops/:id/status - update status (superadmin)
router.put('/:id/status', verifyToken, isSuperAdmin, shopController.updateShopStatus);

// PUT /api/shops/:id/commission - update commission (superadmin)
router.put('/:id/commission', verifyToken, isSuperAdmin, shopController.updateShopCommission);

// PUT /api/shops/:id or PUT /api/shops/my - update shop
router.put('/:id', verifyToken, shopController.updateShop);

module.exports = router;
