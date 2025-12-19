const express = require('express');
const router = express.Router();
const garageController = require('../controllers/garageController');
const { verifyToken } = require('../middleware/authMiddleware');

// All garage routes require authentication
router.use(verifyToken);

// Get my garage (saved vehicles)
router.get('/', garageController.getMyGarage);

// Add vehicle to garage
router.post('/', garageController.addVehicleToGarage);

// Remove vehicle from garage
router.delete('/:vehicleId', garageController.removeVehicleFromGarage);

// Set primary vehicle
router.put('/primary', garageController.setPrimaryVehicle);

module.exports = router;
