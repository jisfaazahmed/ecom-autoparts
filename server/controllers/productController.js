const Product = require('../models/product');
const Vehicle = require('../models/vehicle');

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

// 2. SEARCH PRODUCTS with advanced filtering, sorting, and pagination
exports.getProducts = async (req, res) => {
  try {
    const { 
      vehicleId, 
      categoryId, 
      search,           // Text search
      minPrice,
      maxPrice,
      inStock,          // true/false
      sortBy,           // price, name, createdAt
      order,            // asc, desc
      page = 1,
      limit = 20
    } = req.query;
    
    const query = { isActive: true }; // Only show active products

    // Filter by Category
    if (categoryId) {
      query.category = categoryId;
    }

    // Filter by Vehicle compatibility
    if (vehicleId) {
      query.compatibleVehicles = vehicleId;
    }

    // Text search (name, description, partNumber)
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { partNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Stock filter
    if (inStock === 'true') {
      query.stock = { $gt: 0 };
    }

    // Build sort object
    let sort = {};
    if (sortBy) {
      const sortOrder = order === 'desc' ? -1 : 1;
      sort[sortBy] = sortOrder;
    } else {
      sort.createdAt = -1; // Default: newest first
    }

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Execute query with pagination
    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('compatibleVehicles', 'year make model')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    // Get total count for pagination
    const total = await Product.countDocuments(query);

    res.json({
      success: true,
      count: products.length,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      products
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};