const express = require('express');
const router = express.Router();
const shopController = require('../controllers/shopController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 * - name: Shops
 *   description: Shop/Vendor profile management
 */

/**
 * @swagger
 * /api/shops:
 *   get:
 *     summary: Get all shops (paginated, superadmin only)
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [approved, pending, rejected, suspended]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of shops with pagination
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Superadmin access only
 */
router.get('/', verifyToken, isSuperAdmin, shopController.getShops);

/**
 * @swagger
 * /api/shops/my:
 *   get:
 *     summary: Get current user's shop info (vendor only)
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Shop information
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not a vendor account
 */
router.get('/my', verifyToken, shopController.getMyShop);

/**
 * @swagger
 * /api/shops/{id}:
 *   get:
 *     summary: Get shop by ID (superadmin only)
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Shop information
 *       404:
 *         description: Shop not found
 *       403:
 *         description: Superadmin access only
 */
router.get('/:id', verifyToken, isSuperAdmin, shopController.getShop);

/**
 * @swagger
 * /api/shops/{id}/status:
 *   put:
 *     summary: Update shop status (superadmin only)
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [approved, pending, rejected, suspended]
 *               reason:
 *                 type: string
 *                 description: Rejection reason (required for rejected status)
 *     responses:
 *       200:
 *         description: Shop status updated
 *       400:
 *         description: Invalid status
 *       403:
 *         description: Superadmin access only
 *       404:
 *         description: Shop not found
 */
router.put('/:id/status', verifyToken, isSuperAdmin, shopController.updateShopStatus);

/**
 * @swagger
 * /api/shops/{id}/commission:
 *   put:
 *     summary: Update shop commission rate (superadmin only)
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               commissionRate:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *     responses:
 *       200:
 *         description: Commission rate updated
 *       400:
 *         description: Invalid commission rate
 *       403:
 *         description: Superadmin access only
 *       404:
 *         description: Shop not found
 */
router.put('/:id/commission', verifyToken, isSuperAdmin, shopController.updateShopCommission);

/**
 * @swagger
 * /api/shops/my:
 *   put:
 *     summary: Update current user's shop info (vendor only)
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shopName:
 *                 type: string
 *               description:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               businessRegistration:
 *                 type: string
 *               logoUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Shop updated successfully
 *       401:
 *         description: Authentication required
 */
router.put('/my', verifyToken, shopController.updateMyShop);

/**
 * @swagger
 * /api/shops/{id}:
 *   put:
 *     summary: Update shop info (superadmin or owner)
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shopName:
 *                 type: string
 *               description:
 *                 type: string
 *               phone:
 *                 type: string
 *               address:
 *                 type: string
 *               businessRegistration:
 *                 type: string
 *               logoUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Shop updated successfully
 *       403:
 *         description: Unauthorized
 *       404:
 *         description: Shop not found
 */
router.put('/:id', verifyToken, shopController.updateShop);

module.exports = router;
