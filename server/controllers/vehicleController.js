const Vehicle = require('../models/vehicle');

function escapeRegex(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 1. ADD VEHICLE (Private - Super Admin Only)
exports.addVehicle = async (req, res) => {
  try {
    const { year, make, model, submodel, engine } = req.body;
    
    const newVehicle = new Vehicle({ year, make, model, submodel, engine });
    await newVehicle.save();
    
    res.status(201).json({ message: 'Vehicle added successfully', vehicle: newVehicle });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'This vehicle already exists.' });
    }
    res.status(500).send('Server Error');
  }
};

// 2. GET YEARS (Public) -> Returns [2025, 2024, 2023...]
exports.getYears = async (req, res) => {
  try {
    const years = await Vehicle.distinct('year');
    res.json(years.sort((a, b) => b - a));
  } catch (err) {
    res.status(500).send('Server Error');
  }
};

// 3. GET MAKES (Public) -> Returns ["Toyota", "Honda"] based on Year
exports.getMakes = async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) return res.status(400).json({ message: 'Year is required' });
    const makes = await Vehicle.find({ year: year }).distinct('make');
    res.json(makes.sort());
  } catch (err) {
    res.status(500).send('Server Error');
  }
};

// 4. GET MODELS (Public) -> Returns ["Civic", "Accord"] based on Year+Make
exports.getModels = async (req, res) => {
  try {
    const { year, make } = req.query;
    if (!year || !make) return res.status(400).json({ message: 'Required fields missing' });
    const models = await Vehicle.find({ year: year, make: make }).distinct('model');
    res.json(models.sort());
  } catch (err) {
    res.status(500).send('Server Error');
  }
};

// 5. RESOLVE VEHICLE (Public) -> Returns a Vehicle _id for (year, make, model, submodel)
exports.resolveVehicle = async (req, res) => {
  try {
    const { year, make, model, submodel } = req.query;
    if (!year || !make || !model) {
      return res.status(400).json({ message: 'year, make, and model are required' });
    }

    const yearNum = Number(year);
    if (!Number.isFinite(yearNum)) {
      return res.status(400).json({ message: 'year must be a number' });
    }

    const makeRx = new RegExp(`^${escapeRegex(make)}$`, 'i');
    const modelRx = new RegExp(`^${escapeRegex(model)}$`, 'i');
    const submodelStr = typeof submodel === 'string' ? submodel.trim() : '';
    const submodelRx = submodelStr ? new RegExp(`^${escapeRegex(submodelStr)}$`, 'i') : null;

    const query = {
      year: yearNum,
      make: makeRx,
      model: modelRx,
    };

    if (submodelRx) {
      query.submodel = submodelRx;
    }

    const vehicle = await Vehicle.findOne(query).select('_id year make model submodel').lean();
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    res.json({
      id: String(vehicle._id),
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      submodel: vehicle.submodel,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};