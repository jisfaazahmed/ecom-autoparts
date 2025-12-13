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