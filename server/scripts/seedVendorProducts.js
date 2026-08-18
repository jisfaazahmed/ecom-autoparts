require('dotenv').config();
const mongoose = require('mongoose');
const slugify = require('slugify');
const config = require('../config/config');

const Category = require('../models/category');
const Product = require('../models/product');
const User = require('../models/user');

async function seedVendorProducts() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const vendorEmail = 'mishalsafeek@icloud.com';
    const vendor = await User.findOne({ email: vendorEmail });

    if (!vendor) {
      console.error(`Vendor not found with email: ${vendorEmail}`);
      process.exit(1);
    }

    console.log(`Found vendor: ${vendor.name} (${vendor._id})`);

    // Ensure category exists
    const categoryName = 'Accessories';
    const categorySlug = slugify(categoryName, { lower: true });
    let category = await Category.findOne({ slug: categorySlug });
    if (!category) {
      category = await Category.create({ name: categoryName, slug: categorySlug, description: 'Auto accessories' });
    }

    const sampleProducts = [
      {
        name: 'Premium Leather Steering Wheel Cover',
        description: 'High-quality leather steering wheel cover.',
        price: 4500,
        stock: 50,
        sku: 'VENDOR-ACC-001',
        partNumber: 'ACC-001',
        image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=500&q=60',
        category: category._id,
        compatibleVehicles: [],
        isActive: true,
        status: 'Approved',
        createdBy: vendor._id,
      },
      {
        name: 'LED Interior Light Kit',
        description: 'Bright LED lights for car interior.',
        price: 2500,
        stock: 100,
        sku: 'VENDOR-ACC-002',
        partNumber: 'ACC-002',
        image: 'https://images.unsplash.com/photo-1600705722908-bab1e61c0b4d?auto=format&fit=crop&w=500&q=60',
        category: category._id,
        compatibleVehicles: [],
        isActive: true,
        status: 'Approved',
        createdBy: vendor._id,
      },
      {
        name: 'All-Weather Floor Mats',
        description: 'Durable rubber floor mats for all seasons.',
        price: 6500,
        stock: 30,
        sku: 'VENDOR-ACC-003',
        partNumber: 'ACC-003',
        image: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&w=500&q=60',
        category: category._id,
        compatibleVehicles: [],
        isActive: true,
        status: 'Approved',
        createdBy: vendor._id,
      }
    ];

    for (const pData of sampleProducts) {
      pData.slug = slugify(pData.name, { lower: true }) + '-' + Math.random().toString(36).substr(2, 5);
      const existing = await Product.findOne({ sku: pData.sku });
      if (!existing) {
        await Product.create(pData);
        console.log(`Created product: ${pData.name}`);
      } else {
        console.log(`Product already exists: ${pData.name}`);
      }
    }

    console.log('Successfully seeded vendor products');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding vendor products:', error);
    process.exit(1);
  }
}

seedVendorProducts();
