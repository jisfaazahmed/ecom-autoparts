const Product = require('../models/product');
const Vehicle = require('../models/vehicle');
const mongoose = require('mongoose');

exports.checkStock = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: 'Invalid items array' });
    }

    const results = [];
    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        results.push({
          productId: item.productId,
          name: 'Unknown Product',
          available: 0,
          requested: item.quantity,
          sufficient: false
        });
        continue;
      }
      
      const product = await Product.findById(item.productId);
      if (!product) {
        results.push({
          productId: item.productId,
          name: 'Unknown Product',
          available: 0,
          requested: item.quantity,
          sufficient: false
        });
        continue;
      }
      
      const available = product.stock || 0;
      results.push({
        productId: product._id,
        name: product.name,
        available: available,
        requested: item.quantity,
        sufficient: available >= item.quantity
      });
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

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
    const { vehicleId, categoryId } = req.query;
    
    const query = {};

    // Filter by Category (e.g., "Brake Pads")
    if (categoryId) {
      query.category = categoryId;
    }

    // Filter by Vehicle (e.g., "Tesla Model S")
    if (vehicleId) {
      // Find products where the 'compatibleVehicles' array CONTAINS this vehicleId
      query.compatibleVehicles = vehicleId;
    }

    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('compatibleVehicles', 'year make model'); // Show car names in result

    res.json(products);
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
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found' 
      });
    }

    res.json({
      success: true,
      product
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
}; 
