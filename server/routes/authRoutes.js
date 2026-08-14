const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const {
	validateAuthRegister,
	validateAuthLogin,
	validateForgotPassword,
	validateResetPassword,
	validateChangePassword,
	validateUpdateProfile,
	validateRegisterVerify,
	validateRegisterResend,
} = require('../middleware/requestValidators');

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
router.post('/register/start', validateAuthRegister, authController.registerStart);

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
router.post('/register/verify', validateRegisterVerify, authController.registerVerify);

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
router.post('/register/resend', validateRegisterResend, authController.registerResend);

// Legacy endpoints kept for compatibility (now instruct clients to use /register/start)
router.post('/register', validateAuthRegister, authController.register);

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
router.post('/login', validateAuthLogin, authController.login);

router.get('/me', verifyToken, authController.getMe);
router.put('/profile', verifyToken, validateUpdateProfile, authController.updateProfile);
router.post('/change-password', verifyToken, validateChangePassword, authController.changePassword);

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
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);

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
router.post('/reset-password', validateResetPassword, authController.resetPassword);

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
router.post('/change-password', verifyToken, validateChangePassword, authController.changePassword);

module.exports = router;