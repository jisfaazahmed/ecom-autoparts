const VehicleBrand = require('../models/vehicleBrand.model');
const VehicleModel = require('../models/vehicleModel.model');

// Helpers to map Mongo docs to API shapes expected by client/src/lib/api.ts
const mapBrand = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  logoUrl: doc.logoUrl ?? undefined,
  created_at: doc.createdAt ? doc.createdAt.toISOString() : undefined,
});

const mapModel = (doc) => {
  const brandId = doc.brand && typeof doc.brand.toString === 'function' && !doc.brand.name
    ? doc.brand.toString()
    : (doc.brand && doc.brand._id ? doc.brand._id.toString() : String(doc.brand));
  const isBrandPopulated = doc.brand && typeof doc.brand === 'object' && doc.brand.name;
  const brand = isBrandPopulated
    ? {
        id: doc.brand._id.toString(),
        name: doc.brand.name,
      }
    : undefined;
  return {
    id: doc._id.toString(),
    name: doc.name,
    brandId,
    created_at: doc.createdAt ? doc.createdAt.toISOString() : undefined,
    ...(brand && { brand }),
  };
};

// ============ BRANDS ============

exports.getVehicleBrands = async (req, res) => {
  try {
    const brands = await VehicleBrand.find().sort({ name: 1 }).exec();
    res.json(brands.map(mapBrand));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch vehicle brands' });
  }
};

exports.createVehicleBrand = async (req, res) => {
  try {
    const { name, logoUrl } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Brand name is required' });
    }

    const existing = await VehicleBrand.findOne({ name: name.trim() }).exec();
    if (existing) {
      return res.status(400).json({ message: 'Brand with this name already exists' });
    }

    const brand = await VehicleBrand.create({
      name: name.trim(),
      logoUrl: logoUrl || null,
    });

    res.status(201).json(mapBrand(brand));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create vehicle brand' });
  }
};

exports.updateVehicleBrand = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logoUrl } = req.body;

    if (name !== undefined && (!name || !String(name).trim())) {
      return res.status(400).json({ message: 'Brand name cannot be empty' });
    }
    const update = {};
    if (name !== undefined) update.name = String(name).trim();
    if (logoUrl !== undefined) update.logoUrl = logoUrl || null;

    const brand = await VehicleBrand.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).exec();

    if (!brand) return res.status(404).json({ message: 'Brand not found' });
    res.json(mapBrand(brand));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update vehicle brand' });
  }
};

exports.deleteVehicleBrand = async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent deletion if models exist for this brand
    const modelCount = await VehicleModel.countDocuments({ brand: id }).exec();
    if (modelCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete brand while models exist. Delete models first.',
      });
    }

    const result = await VehicleBrand.findByIdAndDelete(id).exec();
    if (!result) return res.status(404).json({ message: 'Brand not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete vehicle brand' });
  }
};

// ============ MODELS ============

exports.getAllVehicleModels = async (req, res) => {
  try {
    const models = await VehicleModel.find()
      .populate('brand', 'name')
      .sort({ name: 1 })
      .exec();
    res.json(models.map(mapModel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch vehicle models' });
  }
};

exports.getVehicleModelsByBrand = async (req, res) => {
  try {
    const { brandId } = req.params;
    const models = await VehicleModel.find({ brand: brandId }).sort({ name: 1 }).exec();
    res.json(models.map(mapModel));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch vehicle models for brand' });
  }
};

exports.createVehicleModel = async (req, res) => {
  try {
    const { name, brandId } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Model name is required' });
    }
    if (!brandId) {
      return res.status(400).json({ message: 'brandId is required' });
    }

    const brandExists = await VehicleBrand.exists({ _id: brandId }).exec();
    if (!brandExists) {
      return res.status(400).json({ message: 'Brand does not exist' });
    }

    const model = await VehicleModel.create({
      name: name.trim(),
      brand: brandId,
    });

    res.status(201).json(mapModel(model));
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Model already exists for this brand' });
    }
    res.status(500).json({ message: 'Failed to create vehicle model' });
  }
};

exports.updateVehicleModel = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, brandId } = req.body;

    if (name !== undefined && (!name || !String(name).trim())) {
      return res.status(400).json({ message: 'Model name cannot be empty' });
    }
    const update = {};
    if (name !== undefined) update.name = String(name).trim();
    if (brandId !== undefined) update.brand = brandId;

    const model = await VehicleModel.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).exec();

    if (!model) return res.status(404).json({ message: 'Model not found' });
    res.json(mapModel(model));
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Duplicate model for this brand' });
    }
    res.status(500).json({ message: 'Failed to update vehicle model' });
  }
};

exports.deleteVehicleModel = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await VehicleModel.findByIdAndDelete(id).exec();
    if (!result) return res.status(404).json({ message: 'Model not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete vehicle model' });
  }
};
