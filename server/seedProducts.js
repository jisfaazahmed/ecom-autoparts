/**
 * Seed script: creates a few sample products and a test category.
 *
 * Run from the server folder with Mongo env vars set (same as the app):
 *   npm run seed:products
 */

require('dotenv').config();
const mongoose = require('mongoose');
const slugify = require('slugify');
const config = require('./config/config');

const Category = require('./models/category');
const Product = require('./models/product');
const Vehicle = require('./models/vehicle');

async function seedProducts() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // 1. Ensure we have a simple test category
    const categoryName = 'Test Parts';
    const categorySlug = slugify(categoryName, { lower: true });

    let category = await Category.findOne({ slug: categorySlug });
    if (!category) {
      category = await Category.create({
        name: categoryName,
        slug: categorySlug,
        description: 'Sample category for testing products and checkout flow',
      });
      console.log('Created category:', category.name);
    } else {
      console.log('Using existing category:', category.name);
    }

    // 1.5 Find a sample vehicle to associate (Toyota Camry 2020 LE)
    // This assumes seed:vehicles has been run or data exists
    const sampleVehicle = await Vehicle.findOne({
      year: 2020,
      make: 'Toyota',
      model: 'Camry',
      submodel: 'LE'
    });
    
    const vehicleIds = sampleVehicle ? [sampleVehicle._id] : [];
    if (sampleVehicle) console.log('Found sample vehicle for compatibility linkage:', sampleVehicle.searchString);

    // 2. Define some easy-to-recognize sample products
    const sampleProducts = [
      {
        name: 'Test Brake Pad Set',
        description: 'Sample brake pad set for testing cart and checkout.',
        price: 3500,
        stock: 25,
        partNumber: 'TEST-BRAKE-001',
        image: '',
        category: category._id,
        compatibleVehicles: vehicleIds,
        isActive: true,
      },
      {
        name: 'Test Engine Oil 5W-30',
        description: 'Sample engine oil product for testing.',
        price: 4200,
        stock: 40,
        partNumber: 'TEST-OIL-002',
        image: '',
        category: category._id,
        compatibleVehicles: [],
        isActive: true,
      },
      {
        name: 'Test Air Filter',
        description: 'Sample air filter for testing search and orders.',
        price: 2800,
        stock: 30,
        partNumber: 'TEST-FILTER-003',
        image: '',
        category: category._id,
        compatibleVehicles: [],
        isActive: true,
      },
    ];

    const partNumbers = sampleProducts.map((p) => p.partNumber);

    // 3. Remove any previous copies of these test products
    await Product.deleteMany({ partNumber: { $in: partNumbers } });

    // 4. Insert the fresh sample products
    await Product.insertMany(sampleProducts);

    console.log(`Inserted ${sampleProducts.length} sample products.`);
    process.exit(0);
  } catch (err) {
    console.error('Product seed failed:', err.message || err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedProducts();
