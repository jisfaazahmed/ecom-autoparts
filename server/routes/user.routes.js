const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { verifyToken } = require('../middleware/authMiddleware');

// GET /api/users/profile - current user profile
router.get('/profile', verifyToken, userController.getMyProfile);
// PUT /api/users/profile - update current user profile
router.put('/profile', verifyToken, userController.updateMyProfile);

// GET /api/users/:id/profile - minimal profile (superadmin or self)
router.get('/:id/profile', verifyToken, userController.getProfile);

module.exports = router;
