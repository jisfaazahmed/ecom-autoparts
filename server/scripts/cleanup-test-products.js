#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');

const Product = require('../models/product');
const Category = require('../models/category');
const User = require('../models/user');
const Vehicle = require('../models/vehicle');

const dbConnect = async () => {
  try {
    const mongoIp = process.env.MONGO_IP || 'localhost';
    const mongoPort = process.env.MONGO_PORT || 27017;
    const mongoUser = process.env.MONGO_USER || 'root';
    const mongoPassword = process.env.MONGO_PASSWORD || 'password';
    const mongoDb = process.env.MONGO_DB || 'ecom-autoparts';
    
    const uri = `mongodb://${mongoUser}:${mongoPassword}@${mongoIp}:${mongoPort}/${mongoDb}?authSource=admin`;
    
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

const cleanupProducts = async () => {
  try {
    console.log('\n=== CLEANUP TEST PRODUCTS ===\n');

    // Find products without createdBy (test data)
    const productsWithoutSeller = await Product.find({ createdBy: null }).select('_id name');
    console.log(`Found ${productsWithoutSeller.length} products without seller (test data)\n`);

    if (productsWithoutSeller.length > 0) {
      console.log('Products to be deleted:');
      productsWithoutSeller.forEach((p, i) => {
        if (i < 10) console.log(`  ${i + 1}. ${p.name}`);
      });
      if (productsWithoutSeller.length > 10) {
        console.log(`  ... and ${productsWithoutSeller.length - 10} more`);
      }

      // Delete them
      const result = await Product.deleteMany({ createdBy: null });
      console.log(`\n✓ Deleted ${result.deletedCount} test products`);
    }

    // Get remaining products with sellers
    const remainingProducts = await Product.find()
      .populate('createdBy', 'name email shopName role')
      .lean();

    console.log(`\n✓ Remaining products: ${remainingProducts.length}\n`);
    console.log('Remaining products:');
    remainingProducts.forEach((p, i) => {
      const seller = p.createdBy || {};
      console.log(`  ${i + 1}. ${p.name} by ${seller.name || 'Unknown'} (${p.status})`);
    });

    // Summary
    console.log(`\n=== SUMMARY ===`);
    const byStatus = remainingProducts.reduce((acc, p) => {
      acc[p.status || 'Pending'] = (acc[p.status || 'Pending'] || 0) + 1;
      return acc;
    }, {});

    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`${status}: ${count}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Connection closed');
  }
};

dbConnect().then(() => cleanupProducts());
