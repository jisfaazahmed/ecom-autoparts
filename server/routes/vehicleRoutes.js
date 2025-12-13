const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// Public Routes (For the Search Bar)
router.get('/years', vehicleController.getYears);
router.get('/makes', vehicleController.getMakes);
router.get('/models', vehicleController.getModels);

// Private Route (Only You can add data)
router.post('/', verifyToken, isSuperAdmin, vehicleController.addVehicle);

module.exports = router;