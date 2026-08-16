const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const vehicleMasterController = require('../controllers/vehicleMaster.controller');
const userVehicleController = require('../controllers/userVehicle.controller');
const regcheckController = require('../controllers/regcheck.controller');
const { verifyToken, isSuperAdmin } = require('../middleware/authMiddleware');

// Public Routes (For the Search Bar - legacy simple vehicle fitment)
router.get('/years', vehicleController.getYears);
router.get('/makes', vehicleController.getMakes);
router.get('/models', vehicleController.getModels);
router.get('/resolve', vehicleController.resolveVehicle);

// ===== Registration Number Lookup =====
router.get('/lookup/:registrationNumber', regcheckController.lookupRegistration);

// Private Route (Only You can add data)
router.post('/', verifyToken, isSuperAdmin, vehicleController.addVehicle);

// ===== Vehicle master data (Brands / Models / Variants) =====

// Brands
router.get('/brands', vehicleMasterController.getVehicleBrands);
router.post('/brands', verifyToken, isSuperAdmin, vehicleMasterController.createVehicleBrand);
router.put('/brands/:id', verifyToken, isSuperAdmin, vehicleMasterController.updateVehicleBrand);
router.delete('/brands/:id', verifyToken, isSuperAdmin, vehicleMasterController.deleteVehicleBrand);

// Models
router.get('/models/all', vehicleMasterController.getAllVehicleModels);
router.get('/models/:brandId', vehicleMasterController.getVehicleModelsByBrand);
router.post('/models', verifyToken, isSuperAdmin, vehicleMasterController.createVehicleModel);
router.put('/models/:id', verifyToken, isSuperAdmin, vehicleMasterController.updateVehicleModel);
router.delete('/models/:id', verifyToken, isSuperAdmin, vehicleMasterController.deleteVehicleModel);

// ===== User vehicles (saved vehicles per user) =====
router.get('/user', verifyToken, userVehicleController.getUserVehicles);
router.post('/user', verifyToken, userVehicleController.addUserVehicle);
router.post('/user/reg', verifyToken, regcheckController.addUserVehicleByReg);
router.put('/user/:vehicleId/active', verifyToken, userVehicleController.setActiveVehicle);
router.delete('/user/:vehicleId', verifyToken, userVehicleController.deleteUserVehicle);

module.exports = router;