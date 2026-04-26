const UserVehicle = require('../models/userVehicle.model');
const VehicleBrand = require('../models/vehicleBrand.model');
const VehicleModel = require('../models/vehicleModel.model');
const VehicleVariant = require('../models/vehicleVariant.model');

function mapUserVehicle(doc) {
  const brand = doc.brand && typeof doc.brand === 'object' && doc.brand.name
    ? { id: doc.brand._id.toString(), name: doc.brand.name, logoUrl: doc.brand.logoUrl }
    : undefined;
  const model = doc.model && typeof doc.model === 'object' && doc.model.name
    ? { id: doc.model._id.toString(), name: doc.model.name, brandId: (doc.model.brand && doc.model.brand.toString && doc.model.brand.toString()) || (doc.model.brand ? String(doc.model.brand) : undefined) }
    : undefined;
  const variant = doc.variant && typeof doc.variant === 'object' && doc.variant.name
    ? { id: doc.variant._id.toString(), name: doc.variant.name, modelId: (doc.variant.model && doc.variant.model.toString && doc.variant.model.toString()) || (doc.variant.model ? String(doc.variant.model) : undefined), yearStart: doc.variant.yearStart, yearEnd: doc.variant.yearEnd }
    : undefined;

  return {
    id: doc._id.toString(),
    userId: doc.user && (doc.user._id ? doc.user._id.toString() : doc.user.toString()),
    brandId: doc.brand && (doc.brand._id ? doc.brand._id.toString() : doc.brand.toString()),
    modelId: doc.model && (doc.model._id ? doc.model._id.toString() : doc.model.toString()),
    variantId: doc.variant && (doc.variant._id ? doc.variant._id.toString() : doc.variant.toString()),
    year: doc.year,
    registrationNumber: doc.registrationNumber ?? undefined,
    isActive: !!doc.isActive,
    ...(brand && { brand }),
    ...(model && { model }),
    ...(variant && { variant }),
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : undefined,
  };
}

exports.getUserVehicles = async (req, res) => {
  try {
    const userId = req.user.id;
    const list = await UserVehicle.find({ user: userId })
      .populate('brand', 'name logoUrl')
      .populate('model', 'name brand')
      .populate('variant', 'name model yearStart yearEnd')
      .sort({ isActive: -1, createdAt: -1 })
      .exec();
    res.json(list.map(mapUserVehicle));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch user vehicles' });
  }
};

exports.addUserVehicle = async (req, res) => {
  try {
    const userId = req.user.id;
    const { brandId, modelId, variantId, year, registrationNumber } = req.body;

    if (!brandId || !modelId || !variantId || year == null) {
      return res.status(400).json({
        message: 'brandId, modelId, variantId, and year are required',
      });
    }

    const yearNum = Number(year);
    if (Number.isNaN(yearNum)) {
      return res.status(400).json({ message: 'year must be a number' });
    }

    const [brandExists, modelExists, variantExists] = await Promise.all([
      VehicleBrand.exists({ _id: brandId }).exec(),
      VehicleModel.exists({ _id: modelId }).exec(),
      VehicleVariant.exists({ _id: variantId }).exec(),
    ]);
    if (!brandExists || !modelExists || !variantExists) {
      return res.status(400).json({ message: 'Invalid brand, model, or variant' });
    }

    const count = await UserVehicle.countDocuments({ user: userId }).exec();
    const isActive = count === 0;

    const uv = await UserVehicle.create({
      user: userId,
      brand: brandId,
      model: modelId,
      variant: variantId,
      year: yearNum,
      registrationNumber: registrationNumber || null,
      isActive,
    });

    const populated = await UserVehicle.findById(uv._id)
      .populate('brand', 'name logoUrl')
      .populate('model', 'name brand')
      .populate('variant', 'name model yearStart yearEnd')
      .exec();

    res.status(201).json(mapUserVehicle(populated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to add vehicle' });
  }
};

exports.setActiveVehicle = async (req, res) => {
  try {
    const userId = req.user.id;
    const { vehicleId } = req.params;

    const vehicle = await UserVehicle.findOne({ _id: vehicleId, user: userId }).exec();
    if (!vehicle) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    await UserVehicle.updateMany({ user: userId }, { isActive: false }).exec();
    await UserVehicle.findByIdAndUpdate(vehicleId, { isActive: true }).exec();

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to set active vehicle' });
  }
};

exports.deleteUserVehicle = async (req, res) => {
  try {
    const userId = req.user.id;
    const { vehicleId } = req.params;

    const result = await UserVehicle.findOneAndDelete({ _id: vehicleId, user: userId }).exec();
    if (!result) {
      return res.status(404).json({ message: 'Vehicle not found' });
    }

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to delete vehicle' });
  }
};
