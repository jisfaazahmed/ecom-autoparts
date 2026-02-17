const VehicleBrand = require('../models/vehicleBrand.model');
const VehicleModel = require('../models/vehicleModel.model');
const VehicleVariant = require('../models/vehicleVariant.model');

// Helpers to map Mongo docs to API shapes expected by client/src/lib/api.ts
const mapBrand = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  logoUrl: doc.logoUrl ?? undefined,
  created_at: doc.createdAt ? doc.createdAt.toISOString() : undefined,
});

const mapModel = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  brandId: doc.brand.toString(),
  created_at: doc.createdAt ? doc.createdAt.toISOString() : undefined,
});

const mapVariant = (doc) => {
  const modelId = doc.model && typeof doc.model.toString === 'function' && !doc.model.name
    ? doc.model.toString()
    : (doc.model && doc.model._id ? doc.model._id.toString() : String(doc.model));
  const isModelPopulated = doc.model && typeof doc.model === 'object' && doc.model.name;
  const model = isModelPopulated
    ? {
        id: doc.model._id.toString(),
        name: doc.model.name,
        brandId: (doc.model.brand && (doc.model.brand.toString ? doc.model.brand.toString() : doc.model.brand)) || undefined,
      }
    : undefined;
  return {
    id: doc._id.toString(),
    name: doc.name,
    modelId,
    yearStart: doc.yearStart,
    yearEnd: doc.yearEnd ?? undefined,
    created_at: doc.createdAt ? doc.createdAt.toISOString() : undefined,
    ...(model && { model }),
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

    // Optional: prevent deletion if models exist for this brand
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
    const models = await VehicleModel.find().sort({ name: 1 }).exec();
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

    // Optional: prevent deletion if variants exist for this model
    const variantCount = await VehicleVariant.countDocuments({ model: id }).exec();
    if (variantCount > 0) {
      return res.status(400).json({
        message: 'Cannot delete model while variants exist. Delete variants first.',
      });
    }

    const result = await VehicleModel.findByIdAndDelete(id).exec();
    if (!result) return res.status(404).json({ message: 'Model not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete vehicle model' });
  }
};

// ============ VARIANTS ============

exports.getAllVehicleVariants = async (req, res) => {
  try {
    const variants = await VehicleVariant.find()
      .populate('model', 'name brand')
      .sort({ name: 1 })
      .exec();
    res.json(variants.map(mapVariant));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch vehicle variants' });
  }
};

exports.getVehicleVariantsByModel = async (req, res) => {
  try {
    const { modelId } = req.params;
    const variants = await VehicleVariant.find({ model: modelId })
      .populate('model', 'name brand')
      .sort({ name: 1 })
      .exec();
    res.json(variants.map(mapVariant));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch vehicle variants for model' });
  }
};

exports.createVehicleVariant = async (req, res) => {
  try {
    const { name, modelId, yearStart, yearEnd } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Variant name is required' });
    }
    if (!modelId) {
      return res.status(400).json({ message: 'modelId is required' });
    }
    const yearStartNum = Number(yearStart);
    if (Number.isNaN(yearStartNum)) {
      return res.status(400).json({ message: 'yearStart is required and must be a number' });
    }
    const yearEndNum = yearEnd != null && yearEnd !== '' ? Number(yearEnd) : null;
    if (yearEndNum != null && Number.isNaN(yearEndNum)) {
      return res.status(400).json({ message: 'yearEnd must be a number if provided' });
    }

    const modelExists = await VehicleModel.exists({ _id: modelId }).exec();
    if (!modelExists) {
      return res.status(400).json({ message: 'Model does not exist' });
    }

    const variant = await VehicleVariant.create({
      name: name.trim(),
      model: modelId,
      yearStart: yearStartNum,
      yearEnd: yearEndNum,
    });

    res.status(201).json(mapVariant(variant));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create vehicle variant' });
  }
};

exports.updateVehicleVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, modelId, yearStart, yearEnd } = req.body;

    const update = {};
    if (name !== undefined) update.name = name.trim();
    if (modelId !== undefined) update.model = modelId;
    if (yearStart !== undefined) {
      const n = Number(yearStart);
      if (Number.isNaN(n)) return res.status(400).json({ message: 'yearStart must be a number' });
      update.yearStart = n;
    }
    if (yearEnd !== undefined) {
      if (yearEnd === null || yearEnd === '') update.yearEnd = null;
      else {
        const n = Number(yearEnd);
        if (Number.isNaN(n)) return res.status(400).json({ message: 'yearEnd must be a number' });
        update.yearEnd = n;
      }
    }

    const variant = await VehicleVariant.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).exec();

    if (!variant) return res.status(404).json({ message: 'Variant not found' });
    res.json(mapVariant(variant));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update vehicle variant' });
  }
};

exports.deleteVehicleVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await VehicleVariant.findByIdAndDelete(id).exec();
    if (!result) return res.status(404).json({ message: 'Variant not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete vehicle variant' });
  }
};

