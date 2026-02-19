const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { verifyToken } = require('../middleware/authMiddleware');

// GET /api/users/:id/profile - minimal profile (superadmin or self)
router.get('/:id/profile', verifyToken, userController.getProfile);

module.exports = router;
