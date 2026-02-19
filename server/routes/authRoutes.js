const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 * name: Auth
 * description: User authentication (Login & Register)
 */

/**
 * @swagger
 * /api/auth/register:
 * post:
 * summary: Register a new user
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - name
 * - email
 * - password
 * properties:
 * name:
 * type: string
 * email:
 * type: string
 * password:
 * type: string
 * role:
 * type: string
 * enum: [CUSTOMER, ADMIN]
 * shopName:
 * type: string
 * description: Only required if role is ADMIN
 * responses:
 * 201:
 * description: Registration successful
 * 400:
 * description: User already exists
 */
router.post('/register', authController.register);
router.post('/register/seller', authController.registerSeller);

/**
 * @swagger
 * /api/auth/login:
 * post:
 * summary: Login to get a token
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - email
 * - password
 * properties:
 * email:
 * type: string
 * password:
 * type: string
 * responses:
 * 200:
 * description: Login successful (Returns Token)
 * 403:
 * description: Account pending or rejected
 */
router.post('/login', authController.login);

router.get('/me', verifyToken, authController.getMe);
router.put('/profile', verifyToken, authController.updateProfile);
router.post('/change-password', verifyToken, authController.changePassword);

module.exports = router;