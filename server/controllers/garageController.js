const User = require('../models/user');
const Vehicle = require('../models/vehicle');

// Get user's saved vehicles (My Garage)
exports.getMyGarage = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('savedVehicles', 'year make model submodel engine');

    res.json({
      success: true,
      count: user.savedVehicles.length,
      vehicles: user.savedVehicles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Add vehicle to garage
exports.addVehicleToGarage = async (req, res) => {
  try {
    const { vehicleId } = req.body;

    // Validate vehicle exists
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    const user = await User.findById(req.user.id);

    // Check if vehicle already in garage
    if (user.savedVehicles.includes(vehicleId)) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle already in your garage'
      });
    }

    user.savedVehicles.push(vehicleId);
    await user.save();

    await user.populate('savedVehicles', 'year make model submodel engine');

    res.json({
      success: true,
      message: 'Vehicle added to garage',
      vehicles: user.savedVehicles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Remove vehicle from garage
exports.removeVehicleFromGarage = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    const user = await User.findById(req.user.id);

    // Check if vehicle is in garage
    if (!user.savedVehicles.includes(vehicleId)) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found in your garage'
      });
    }

    user.savedVehicles = user.savedVehicles.filter(
      v => v.toString() !== vehicleId
    );
    await user.save();

    await user.populate('savedVehicles', 'year make model submodel engine');

    res.json({
      success: true,
      message: 'Vehicle removed from garage',
      vehicles: user.savedVehicles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Set primary vehicle (move to first position)
exports.setPrimaryVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.body;

    const user = await User.findById(req.user.id);

    // Check if vehicle is in garage
    const vehicleIndex = user.savedVehicles.findIndex(
      v => v.toString() === vehicleId
    );

    if (vehicleIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found in your garage'
      });
    }

    // Move vehicle to first position
    const [vehicle] = user.savedVehicles.splice(vehicleIndex, 1);
    user.savedVehicles.unshift(vehicle);
    await user.save();

    await user.populate('savedVehicles', 'year make model submodel engine');

    res.json({
      success: true,
      message: 'Primary vehicle updated',
      vehicles: user.savedVehicles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};