const xml2js = require('xml2js');
const VehicleBrand = require('../models/vehicleBrand.model');
const VehicleModel = require('../models/vehicleModel.model');
const VehicleVariant = require('../models/vehicleVariant.model');
const UserVehicle = require('../models/userVehicle.model');

const REGCHECK_BASE = 'https://www.regcheck.org.uk/api/reg.asmx/CheckSriLanka';
const REGCHECK_USERNAME = process.env.REGCHECK_USERNAME || '';

/**
 * Parse the RegCheck XML response and extract vehicle data.
 * Prioritises the `vehicleJson` field (a JSON string embedded in the XML).
 * Falls back to the `vehicleData` XML element if vehicleJson is empty.
 */
async function parseRegCheckXml(xmlText) {
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
  const parsed = await parser.parseStringPromise(xmlText);

  // The root element is <Vehicle xmlns="http://regcheck.org.uk">
  const vehicle = parsed.Vehicle || parsed['Vehicle'];
  if (!vehicle) {
    throw new Error('Unexpected XML structure — no <Vehicle> root element');
  }

  // 1. Try vehicleJson first (it's a JSON string inside the XML)
  const vehicleJsonStr = vehicle.vehicleJson;
  if (vehicleJsonStr && typeof vehicleJsonStr === 'string' && vehicleJsonStr.trim()) {
    try {
      const jsonData = JSON.parse(vehicleJsonStr);
      return normalizeFromJson(jsonData);
    } catch {
      // vehicleJson wasn't valid JSON, fall through to vehicleData
    }
  }

  // 2. Fall back to vehicleData XML fields
  const vd = vehicle.vehicleData;
  if (!vd) {
    throw new Error('No vehicle data found in response');
  }
  return normalizeFromXmlData(vd);
}

// Normalize vehicle info from the parsed vehicleJson object.

function normalizeFromJson(json) {
  // Recursively extract a string from a field that may be:
  //   - a plain string
  //   - { CurrentTextValue: "..." }
  //   - { CurrentTextValue: { _: "..." } }
  //   - { CurrentValue: "..." }
  //   - a number
  const txt = (field) => {
    if (field == null) return '';
    if (typeof field === 'string') return field;
    if (typeof field === 'number') return String(field);
    if (typeof field === 'object') {
      // Try common property names for the display text
      for (const key of ['CurrentTextValue', 'currentTextValue', 'CurrentValue', 'currentValue', '_']) {
        if (field[key] != null) {
          const val = field[key];
          if (typeof val === 'string') return val;
          if (typeof val === 'number') return String(val);
          if (typeof val === 'object') return txt(val); // recurse
        }
      }
      return '';
    }
    return String(field);
  };

  return {
    description: txt(json.Description) || txt(json.description) || '',
    make: txt(json.CarMake) || txt(json.Make) || txt(json.MakeDescription) || txt(json.carMake) || '',
    model: txt(json.CarModel) || txt(json.Model) || txt(json.ModelDescription) || txt(json.carModel) || '',
    year: parseYear(json.RegistrationYear || json.registrationYear || json.YearOfManufacture || json.ManufactureYearFrom),
    bodyStyle: txt(json.BodyStyle) || txt(json.bodyStyle) || '',
    engineSize: txt(json.EngineSize) || txt(json.engineSize) || '',
    transmission: txt(json.Transmission) || txt(json.transmission) || '',
    fuelType: txt(json.FuelType) || txt(json.fuelType) || '',
    numberOfDoors: txt(json.NumberOfDoors) || txt(json.numberOfDoors) || '',
    numberOfSeats: txt(json.NumberOfSeats) || txt(json.numberOfSeats) || '',
    driverSide: txt(json.DriverSide) || txt(json.driverSide) || '',
    indicativeValue: txt(json.IndicativeValue) || txt(json.indicativeValue) || '',
    immobiliser: txt(json.Immobiliser) || txt(json.immobiliser) || '',
  };
}

// Normalize vehicle info from the vehicleData XML element (after xml2js parsing).

function normalizeFromXmlData(vd) {
  const txt = (node) => {
    if (!node) return '';
    if (typeof node === 'string') return node;
    // xml2js with explicitArray:false may give { _: 'value', $: { type: ... } }
    if (node._ ) return node._;
    if (node.CurrentTextValue) {
      const ctv = node.CurrentTextValue;
      return typeof ctv === 'string' ? ctv : (ctv._ || '');
    }
    return '';
  };

  return {
    description: txt(vd.Description),
    make: txt(vd.CarMake) || txt(vd.MakeDescription),
    model: txt(vd.CarModel) || txt(vd.ModelDescription),
    year: parseYear(vd.RegistrationYear || vd.ManufactureYearFrom),
    bodyStyle: txt(vd.BodyStyle),
    engineSize: txt(vd.EngineSize),
    transmission: txt(vd.Transmission),
    fuelType: txt(vd.FuelType),
    numberOfDoors: txt(vd.NumberOfDoors),
    numberOfSeats: txt(vd.NumberOfSeats),
    driverSide: txt(vd.DriverSide),
    indicativeValue: txt(vd.IndicativeValue),
    immobiliser: txt(vd.Immobiliser),
  };
}

function parseYear(val) {
  if (!val) return null;
  const str = typeof val === 'string' ? val : (val._ || val.CurrentTextValue || String(val));
  const num = parseInt(str, 10);
  return Number.isNaN(num) ? null : num;
}

const normalizeRegNumber = (reg) => {
  return reg
    .toUpperCase()
    .replace(/\s+/g, '')       // remove spaces
    .replace(/^([A-Z]{2,3})(\d{4})$/, '$1-$2'); // add dash if missing
};

exports.lookupRegistration = async (req, res) => {
  try {
    const { registrationNumber } = req.params;

    if (!registrationNumber || registrationNumber.trim().length === 0) {
      return res.status(400).json({ message: 'Registration number is required' });
    }

    if (!REGCHECK_USERNAME) {
      return res.status(500).json({ message: 'RegCheck API username not configured' });
    }

    const normalizedRegNumber = normalizeRegNumber(registrationNumber);

    // 1. Call RegCheck API
    const url = `${REGCHECK_BASE}?RegistrationNumber=${encodeURIComponent(normalizedRegNumber)}&username=${encodeURIComponent(REGCHECK_USERNAME)}`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(502).json({
        message: `RegCheck API returned status ${response.status}`,
      });
    }

    const xmlText = await response.text();
    console.log('XML response:'); 
    console.log(xmlText);

    // 2. Parse API response
    const decoded = await parseRegCheckXml(xmlText);

    if (!decoded.make && !decoded.model) {
      return res.status(404).json({ message: 'No vehicle data found for this registration number' });
    }

    // 3. Check whether the decoded vehicle exists in DB
    let matchedBrand = null;
    let matchedModel = null;
    let matchedVariant = null;

    if (decoded.make) {
      const splittedMake = decoded.make.split(' ');
      matchedBrand = await VehicleBrand.findOne({
      name: {
        $regex: splittedMake.join('|'),
        $options: 'i'
      }
      }).exec();
    }

    if (matchedBrand && decoded.model) {
      const splittedModel = decoded.model.split(' ');
      matchedModel = await VehicleModel.findOne({
        name: {
        $regex: splittedModel.join('|'),
        $options: 'i'
      }
      }).exec();
    }

    if (matchedModel && decoded.year) {
      matchedVariant = await VehicleVariant.findOne({
        model: matchedModel._id,
        yearStart: { $lte: decoded.year },
        $or: [
          { yearEnd: { $gte: decoded.year } },
          { yearEnd: null },
        ],
      }).exec();
    }

    // 4. If brand+model not found in DB, vehicle is not in the system
    if (!matchedBrand || !matchedModel) {
      return res.json({
        found: false,
        message: 'This vehicle is not currently available in our system',
      });
    }

    // 5. Vehicle exists in DB — return DB names for user confirmation
    res.json({
      found: true,
      vehicle: {
        registrationNumber: normalizedRegNumber,
        brand: { id: matchedBrand._id.toString(), name: matchedBrand.name, logoUrl: matchedBrand.logoUrl },
        model: { id: matchedModel._id.toString(), name: matchedModel.name },
        variant: matchedVariant
          ? {
              id: matchedVariant._id.toString(),
              name: matchedVariant.name,
              yearStart: matchedVariant.yearStart,
              yearEnd: matchedVariant.yearEnd,
            }
          : null,
        year: decoded.year,
      },
    });
  } catch (err) {
    console.error('Registration lookup error:', err);
    res.status(500).json({ message: 'Failed to look up registration number' });
  }
};

/**
 * Save a vehicle (from a previously looked-up reg number) as a user vehicle.
 * Accepts DB IDs returned by the lookup endpoint — does NOT auto-create records.
 *
 * POST /vehicles/user/reg
 * Body: { registrationNumber, brandId, modelId, variantId?, year }
 */
exports.addUserVehicleByReg = async (req, res) => {
  try {
    const userId = req.user.id;
    const { registrationNumber, brandId, modelId, variantId, year } = req.body;

    if (!registrationNumber || !registrationNumber.trim()) {
      return res.status(400).json({ message: 'Registration number is required' });
    }
    if (!brandId || !modelId) {
      return res.status(400).json({ message: 'Brand and model are required' });
    }

    const normalizedRegNumber = normalizeRegNumber(registrationNumber);
    const vehicleYear = parseInt(year, 10) || new Date().getFullYear();

    // Validate that brand, model, and variant exist in DB
    const brand = await VehicleBrand.findById(brandId).exec();
    if (!brand) {
      return res.status(404).json({ message: 'Brand not found' });
    }

    const vehicleModel = await VehicleModel.findById(modelId).exec();
    if (!vehicleModel) {
      return res.status(404).json({ message: 'Model not found' });
    }

    let variant = null;
    if (variantId) {
      variant = await VehicleVariant.findById(variantId).exec();
      if (!variant) {
        return res.status(404).json({ message: 'Variant not found' });
      }
    } else {
      // If no variant was matched during lookup, try to find a default one
      variant = await VehicleVariant.findOne({ model: vehicleModel._id }).exec();
      if (!variant) {
        return res.status(404).json({ message: 'No variant found for this model' });
      }
    }

    // Check if user already has this exact vehicle
    const existing = await UserVehicle.findOne({
      user: userId,
      brand: brand._id,
      model: vehicleModel._id,
      variant: variant._id,
      year: vehicleYear,
    }).exec();

    if (existing) {
      if (!existing.registrationNumber) {
        existing.registrationNumber = normalizedRegNumber;
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
      year: vehicleYear,
      registrationNumber: normalizedRegNumber,
      isActive,
    });

    const populated = await UserVehicle.findById(uv._id)
      .populate('brand', 'name logoUrl')
      .populate('model', 'name brand')
      .populate('variant', 'name model yearStart yearEnd')
      .exec();

    res.status(201).json(mapUserVehicle(populated));
  } catch (err) {
    console.error('Add vehicle by registration error:', err);
    res.status(500).json({ message: 'Failed to add vehicle' });
  }
};

// ─── Helpers ───────────────────────────────────────────────

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
    registrationNumber: doc.normalizedRegNumber ?? undefined,
    isActive: !!doc.isActive,
    ...(brand && { brand }),
    ...(model && { model }),
    ...(variant && { variant }),
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : undefined,
  };
}
