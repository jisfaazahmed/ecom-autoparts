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

// ========== PASSWORD RESET ENDPOINTS ==========
/**
 * @swagger
 * /api/auth/forgot-password:
 * post:
 * summary: Request password reset (sends link to email)
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - email
 * properties:
 * email:
 * type: string
 * responses:
 * 200:
 * description: Password reset link sent to email
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 * post:
 * summary: Reset password with token
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - token
 * - password
 * - passwordConfirm
 * properties:
 * token:
 * type: string
 * description: Reset token from email link
 * password:
 * type: string
 * passwordConfirm:
 * type: string
 * responses:
 * 200:
 * description: Password reset successfully
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @swagger
 * /api/auth/change-password:
 * post:
 * summary: Change password when logged in
 * tags: [Auth]
 * security:
 * - bearerAuth: []
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - currentPassword
 * - newPassword
 * - passwordConfirm
 * properties:
 * currentPassword:
 * type: string
 * newPassword:
 * type: string
 * passwordConfirm:
 * type: string
 * responses:
 * 200:
 * description: Password changed successfully
 */
router.post('/change-password', verifyToken, authController.changePassword);

module.exports = router;