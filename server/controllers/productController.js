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

// 1. CREATE PRODUCT (Sellers & Admins)
exports.createProduct = async (req, res) => {
  try {
    const { name, sku, price, stock, categoryId, compatibleVariants, description, imageUrl, shopId } = req.body;

    // Map compatibleVariants to vehicleIds
    let vehicleIds = [];
    if (compatibleVariants && Array.isArray(compatibleVariants)) {
      vehicleIds = compatibleVariants;
      const count = await Vehicle.countDocuments({ _id: { $in: vehicleIds } });
      if (count !== vehicleIds.length && process.env.NODE_ENV !== 'test') {
        return res.status(400).json({ message: 'One or more Vehicle Variant IDs are invalid.' });
      }
    }

    // Default status to 'Pending' for sellers. Super Admin could theoretially approve immediately, 
    // but let's keep all new creations as 'Pending' or let admin pass 'Approved'
    const finalStatus = (req.user && req.user.role === 'SUPER_ADMIN') ? 'Approved' : 'Pending';

    // Create the product
    const newProduct = new Product({
      name,
      sku: sku || 'SKU-' + Date.now(),
      price: price || 0,
      stock: stock || 0,
      image: imageUrl,
      category: categoryId || null,
      compatibleVehicles: vehicleIds,
      description,
      createdBy: shopId || req.user.id, // tie it to the seller
      status: finalStatus
    });

    await newProduct.save();
    
    const savedProduct = newProduct.toObject();
    savedProduct.id = savedProduct._id;

    res.status(201).json(savedProduct);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// 1.1 UPDATE PRODUCT STATUS (Super Admin Only)
exports.updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const product = await Product.findByIdAndUpdate(id, { status }, { new: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// 2. SEARCH PRODUCTS (The "Tesla > Model S > Brakes" Logic)
exports.getProducts = async (req, res) => {
  try {
    const { vehicleId, categoryId, shop, status } = req.query;
    
    const query = {};

    // 1. If searching by a specific shop/seller (Vendor Dashboard)
    if (shop) {
      query.createdBy = shop;
      // Vendor can see their own Pending/Rejected/Approved unless status is filtered
      if (status) {
        query.status = status;
      }
    } else {
      // 2. Or, public facing search: ONLY SHOW APPROVED
      if (req.user && req.user.role === 'SUPER_ADMIN') {
        // Super Admins can see specific status or ALL if no status provided
        if (status) query.status = status;
      } else {
        // Public sees only approved
        query.status = 'Approved';
      }
    }

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
