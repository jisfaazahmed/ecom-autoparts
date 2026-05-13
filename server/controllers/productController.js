const Product = require('../models/product');
const Vehicle = require('../models/vehicle');
const VehicleBrand = require('../models/vehicleBrand.model');
const VehicleModel = require('../models/vehicleModel.model');

// ── Helper: transform a populated product doc for the frontend ──
function transformProduct(p) {
  const obj = typeof p.toObject === 'function' ? p.toObject() : { ...p };
  obj.id = obj._id.toString();
  delete obj._id;

  obj.rating = typeof obj.rating === 'number' ? obj.rating : 0;
  obj.reviewCount = typeof obj.reviewCount === 'number' ? obj.reviewCount : 0;

  // category
  if (obj.category && typeof obj.category === 'object' && obj.category._id) {
    obj.categoryId = obj.category._id.toString();
    obj.category = { id: obj.categoryId, name: obj.category.name };
  }

  // compatibleVehicleModels (new system — model-level compatibility)
  if (Array.isArray(obj.compatibleVehicleModels)) {
    obj.compatibleVehicleModels = obj.compatibleVehicleModels.map((m) => {
      if (m && typeof m === 'object' && m._id) {
        const mapped = {
          id: m._id.toString(),
          name: m.name,
        };
        // include populated brand info when available
        if (m.brand && typeof m.brand === 'object' && m.brand._id) {
          mapped.brandId = m.brand._id.toString();
          mapped.brandName = m.brand.name;
        }
        return mapped;
      }
      return typeof m === 'object' ? m.toString() : m;
    });
  }

  obj.imageUrl = obj.image || null;
  return obj;
}

// ── Populate chain shared between getProducts & getProductById ──
function applyPopulates(query) {
  return query
    .populate('category', 'name slug')
    .populate('compatibleVehicles', 'year make model')
    .populate({
      path: 'compatibleVehicleModels',
      select: 'name brand',
      populate: { path: 'brand', select: 'name' },
    });
}

// 1. CREATE MASTER PRODUCT (Super Admin Only)
exports.createProduct = async (req, res) => {
  try {
    const { name, partNumber, categoryId, vehicleIds, description } = req.body;

    const count = await Vehicle.countDocuments({ _id: { $in: vehicleIds } });
    
    if (count !== vehicleIds.length) {
      return res.status(400).json({ message: 'One or more Vehicle IDs are invalid.' });
    }

    // Create the product
    const newProduct = new Product({
      name,
      partNumber,
      category: categoryId,
      compatibleVehicles: vehicleIds, // Array of Vehicle IDs (e.g., [TeslaID, HondaID])
      description,
      createdBy: req.user.id
    });

    await newProduct.save();
    res.status(201).json({ message: 'Master Product Created', product: newProduct });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

// 2. SEARCH PRODUCTS (The "Tesla > Model S > Brakes" Logic)
exports.getProducts = async (req, res) => {
  try {
    const {
      vehicleId,
      categoryId,
      category,          // alias used by frontend
      isActive,
      search,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
      page = 1,
      limit = 20,
      make,              // vehicle brand name for compatibility filter
      model: vehicleModel, // vehicle model name for compatibility filter
      year: vehicleYear,   // vehicle year for compatibility filter (unused for matching, kept for API compat)
    } = req.query;

    const query = {};

    // Filter by Category
    const catId = categoryId || category;
    if (catId) {
      query.category = catId;
    }

    // Filter by Vehicle (legacy single ID)
    if (vehicleId) {
      query.compatibleVehicles = vehicleId;
    }

    // Filter by vehicle make/model — uses the VehicleModel system directly
    if (make && vehicleModel) {
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Step 1: Find the VehicleBrand by name
      const brand = await VehicleBrand.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(make)}$`, 'i') },
      });

      if (!brand) {
        return res.json({
          products: [],
          pagination: { page: 1, limit: parseInt(limit, 10) || 20, total: 0, totalPages: 0 },
        });
      }

      // Step 2: Find the VehicleModel by name + brand
      const vModel = await VehicleModel.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(vehicleModel)}$`, 'i') },
        brand: brand._id,
      });

      if (!vModel) {
        return res.json({
          products: [],
          pagination: { page: 1, limit: parseInt(limit, 10) || 20, total: 0, totalPages: 0 },
        });
      }

      // Step 3: Filter products by the matched model ID
      query.compatibleVehicleModels = vModel._id;
    }

    // Filter by active status
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    // Search by name, description, or partNumber
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { partNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Price range
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Sorting
    let sort = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      applyPopulates(Product.find(query))
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(query),
    ]);

    const transformed = products.map(transformProduct);

    res.json({
      products: transformed,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

exports.getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({ featured: true, isActive: true })
      .sort({ rating: -1 })
      .limit(8);

    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    
    res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await applyPopulates(Product.findById(req.params.id));

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.json(transformProduct(product));
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
