const VehicleBrand = require('../models/vehicleBrand.model');
const VehicleModel = require('../models/vehicleModel.model');
const VehicleVariant = require('../models/vehicleVariant.model');
const UserVehicle = require('../models/userVehicle.model');

const NHTSA_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues';

//GET /vehicles/decode-vin/:vin?modelyear=YYYY
exports.decodeVin = async (req, res) => {
  try {
    const { vin } = req.params;
    const { modelyear } = req.query;

    if (!vin || vin.length !== 17) {
      return res.status(400).json({ message: 'VIN must be exactly 17 characters' });
    }

    // Build NHTSA URL
    let url = `${NHTSA_BASE}/${encodeURIComponent(vin)}?format=json`;
    if (modelyear) url += `&modelyear=${encodeURIComponent(modelyear)}`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(502).json({ message: 'Failed to reach NHTSA API' });
    }

    const data = await response.json();
    const results = data.Results && data.Results[0];

    if (!results) {
      return res.status(404).json({ message: 'No results returned from NHTSA' });
    }

    // Check for decode errors
    const errorCode = results.ErrorCode;
    // ErrorCode "0" means no errors. Anything with significant errors like "1" means issues.
    // Multiple codes can be comma-separated, e.g. "1,4"
    const errorCodes = errorCode ? errorCode.split(',').map((c) => c.trim()) : [];
    const hasErrors = errorCodes.some((c) => c !== '0' && c !== '');

    if (hasErrors && !results.Make) {
      return res.status(400).json({
        message: results.ErrorText || 'Unable to decode VIN',
        errorCode,
      });
    }

    // Extract relevant fields from NHTSA response
    const decoded = {
      vin: results.VIN || vin,
      make: results.Make || '',
      model: results.Model || '',
      modelYear: results.ModelYear ? parseInt(results.ModelYear, 10) : null,
      trim: results.Trim || '',
      bodyClass: results.BodyClass || '',
      driveType: results.DriveType || '',
      fuelType: results.FuelTypePrimary || '',
      engineCylinders: results.EngineCylinders || '',
      engineDisplacement: results.DisplacementL || '',
      transmissionStyle: results.TransmissionStyle || '',
      plantCountry: results.PlantCountry || '',
      vehicleType: results.VehicleType || '',
      errorCode,
      errorText: results.ErrorText || '',
    };

    // Try to match to existing database entries (case-insensitive)
    let matchedBrand = null;
    let matchedModel = null;
    let matchedVariant = null;

    if (decoded.make) {
      matchedBrand = await VehicleBrand.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(decoded.make)}$`, 'i') },
      }).exec();
    }

    if (matchedBrand && decoded.model) {
      matchedModel = await VehicleModel.findOne({
        brand: matchedBrand._id,
        name: { $regex: new RegExp(`^${escapeRegex(decoded.model)}$`, 'i') },
      }).exec();
    }

    if (matchedModel && decoded.trim) {
      matchedVariant = await VehicleVariant.findOne({
        model: matchedModel._id,
        name: { $regex: new RegExp(`^${escapeRegex(decoded.trim)}$`, 'i') },
      }).exec();
    }

    // If no variant matched by trim, try finding any variant for the model
    // that covers the decoded year
    if (matchedModel && !matchedVariant && decoded.modelYear) {
      matchedVariant = await VehicleVariant.findOne({
        model: matchedModel._id,
        yearStart: { $lte: decoded.modelYear },
        $or: [
          { yearEnd: { $gte: decoded.modelYear } },
          { yearEnd: null },
        ],
      }).exec();
    }

    res.json({
      decoded,
      matched: {
        brand: matchedBrand
          ? { id: matchedBrand._id.toString(), name: matchedBrand.name, logoUrl: matchedBrand.logoUrl }
          : null,
        model: matchedModel
          ? { id: matchedModel._id.toString(), name: matchedModel.name }
          : null,
        variant: matchedVariant
          ? {
              id: matchedVariant._id.toString(),
              name: matchedVariant.name,
              yearStart: matchedVariant.yearStart,
              yearEnd: matchedVariant.yearEnd,
            }
          : null,
      },
    });
  } catch (err) {
    console.error('VIN decode error:', err);
    res.status(500).json({ message: 'Failed to decode VIN' });
  }
};

/**
 * Decode VIN and save as a user vehicle.
 * Auto-creates brand/model/variant if they don't exist in the DB.
 *
 * POST /vehicles/user/vin
 * Body: { vin }
 */
exports.addUserVehicleByVin = async (req, res) => {
  try {
    const userId = req.user.id;
    const { vin } = req.body;

    if (!vin || vin.length !== 17) {
      return res.status(400).json({ message: 'VIN must be exactly 17 characters' });
    }

    // Decode VIN via NHTSA
    const url = `${NHTSA_BASE}/${encodeURIComponent(vin)}?format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(502).json({ message: 'Failed to reach NHTSA API' });
    }

    const data = await response.json();
    const results = data.Results && data.Results[0];

    if (!results || !results.Make || !results.Model || !results.ModelYear) {
      return res.status(400).json({
        message: 'Could not decode VIN — make, model, or year not found',
      });
    }

    const make = results.Make.trim();
    const model = results.Model.trim();
    const year = parseInt(results.ModelYear, 10);
    const trim = (results.Trim || '').trim() || 'Base';

    if (Number.isNaN(year)) {
      return res.status(400).json({ message: 'Invalid model year from VIN' });
    }

    // Find or create Brand
    let brand = await VehicleBrand.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(make)}$`, 'i') },
    }).exec();

    if (!brand) {
      brand = await VehicleBrand.create({ name: make });
    }

    // Find or create Model
    let vehicleModel = await VehicleModel.findOne({
      brand: brand._id,
      name: { $regex: new RegExp(`^${escapeRegex(model)}$`, 'i') },
    }).exec();

    if (!vehicleModel) {
      vehicleModel = await VehicleModel.create({ name: model, brand: brand._id });
    }

    // Find or create Variant
    let variant = await VehicleVariant.findOne({
      model: vehicleModel._id,
      name: { $regex: new RegExp(`^${escapeRegex(trim)}$`, 'i') },
    }).exec();

    if (!variant) {
      variant = await VehicleVariant.create({
        name: trim,
        model: vehicleModel._id,
        yearStart: year,
        yearEnd: year,
      });
    } else {
      // Extend year range if needed
      let updated = false;
      if (year < variant.yearStart) { variant.yearStart = year; updated = true; }
      if (!variant.yearEnd || year > variant.yearEnd) { variant.yearEnd = year; updated = true; }
      if (updated) await variant.save();
    }

    // Check if user already has this exact vehicle
    const existing = await UserVehicle.findOne({
      user: userId,
      brand: brand._id,
      model: vehicleModel._id,
      variant: variant._id,
      year,
    }).exec();

    if (existing) {
      // Update VIN if not set, then return existing
      if (!existing.vin) {
        existing.vin = vin;
        await existing.save();
      }
      const populated = await UserVehicle.findById(existing._id)
        .populate('brand', 'name logoUrl')
        .populate('model', 'name brand')
        .populate('variant', 'name model yearStart yearEnd')
        .exec();
      return res.status(200).json(mapUserVehicle(populated));
    }

    // Set as active if first vehicle
    const count = await UserVehicle.countDocuments({ user: userId }).exec();
    const isActive = count === 0;

    const uv = await UserVehicle.create({
      user: userId,
      brand: brand._id,
      model: vehicleModel._id,
      variant: variant._id,
      year,
      vin,
      isActive,
    });

    const populated = await UserVehicle.findById(uv._id)
      .populate('brand', 'name logoUrl')
      .populate('model', 'name brand')
      .populate('variant', 'name model yearStart yearEnd')
      .exec();

    res.status(201).json(mapUserVehicle(populated));
  } catch (err) {
    console.error('Add vehicle by VIN error:', err);
    res.status(500).json({ message: 'Failed to add vehicle' });
  }
};

// ─── Helpers ───────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapUserVehicle(doc) {
  const brand =
    doc.brand && typeof doc.brand === 'object' && doc.brand.name
      ? { id: doc.brand._id.toString(), name: doc.brand.name, logoUrl: doc.brand.logoUrl }
      : undefined;
  const model =
    doc.model && typeof doc.model === 'object' && doc.model.name
      ? { id: doc.model._id.toString(), name: doc.model.name }
      : undefined;
  const variant =
    doc.variant && typeof doc.variant === 'object' && doc.variant.name
      ? {
          id: doc.variant._id.toString(),
          name: doc.variant.name,
          yearStart: doc.variant.yearStart,
          yearEnd: doc.variant.yearEnd,
        }
      : undefined;

  return {
    id: doc._id.toString(),
    userId: doc.user && (doc.user._id ? doc.user._id.toString() : doc.user.toString()),
    brandId: doc.brand && (doc.brand._id ? doc.brand._id.toString() : doc.brand.toString()),
    modelId: doc.model && (doc.model._id ? doc.model._id.toString() : doc.model.toString()),
    variantId: doc.variant && (doc.variant._id ? doc.variant._id.toString() : doc.variant.toString()),
    year: doc.year,
    vin: doc.vin ?? undefined,
    isActive: !!doc.isActive,
    ...(brand && { brand }),
    ...(model && { model }),
    ...(variant && { variant }),
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : undefined,
  };
}
