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
 * /api/auth/register/start:
 * post:
 * summary: Start registration (sends email OTP)
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
 * description: OTP sent
 * 400:
 * description: Validation error
 */
router.post('/register/start', authController.registerStart);

/**
 * @swagger
 * /api/auth/register/verify:
 * post:
 * summary: Verify email OTP and complete registration
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - verificationId
 * - otp
 * properties:
 * verificationId:
 * type: string
 * otp:
 * type: string
 * responses:
 * 200:
 * description: Registration verified, tokens returned
 * 400:
 * description: Invalid or expired OTP
 * 429:
 * description: Too many attempts
 */
router.post('/register/verify', authController.registerVerify);

/**
 * @swagger
 * /api/auth/register/resend:
 * post:
 * summary: Resend email OTP for registration
 * tags: [Auth]
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - verificationId
 * properties:
 * verificationId:
 * type: string
 * responses:
 * 200:
 * description: OTP resent
 * 429:
 * description: Too many requests
 */
router.post('/register/resend', authController.registerResend);

// Legacy endpoints kept for compatibility (now instruct clients to use /register/start)
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