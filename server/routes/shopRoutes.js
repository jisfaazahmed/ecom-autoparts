const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const { verifyToken } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 * name: Shops
 * description: Shop/Vendor profile management
 */

/**
 * @swagger
 * /api/shops/my:
 * get:
 * summary: Get current user's shop info
 * tags: [Shops]
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Shop information
 * 401:
 * description: Authentication required
 */
router.get('/my', verifyToken, shopController.getMyShop);

/**
 * @swagger
 * /api/shops/my:
 * put:
 * summary: Update current user's shop info
 * tags: [Shops]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: false
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * name:
 * type: string
 * description:
 * type: string
 * phone:
 * type: string
 * address:
 * type: string
 * businessRegistration:
 * type: string
 * logoUrl:
 * type: string
 * responses:
 * 200:
 * description: Shop updated successfully
 * 401:
 * description: Authentication required
 */
router.put('/my', verifyToken, shopController.updateMyShop);

/**
 * @swagger
 * /api/shops/{id}:
 * get:
 * summary: Get shop by ID
 * tags: [Shops]
 * parameters:
 * - in: path
 * name: id
 * required: true
 * schema:
 * type: string
 * responses:
 * 200:
 * description: Shop information
 * 404:
 * description: Shop not found
 */
router.get('/:id', verifyToken, shopController.getShop);

module.exports = router;
