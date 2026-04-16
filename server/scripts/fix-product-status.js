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

const fixProductStatus = async () => {
  try {
    console.log('\n=== FIX PRODUCT STATUS ===\n');

    // Get products without status
    const productsWithoutStatus = await Product.find({ status: { $in: [null, undefined, ''] } });
    console.log(`Found ${productsWithoutStatus.length} products without status\n`);

    if (productsWithoutStatus.length > 0) {
      // Set default status to "Pending" for all products
      const result = await Product.updateMany(
        { status: { $in: [null, undefined, ''] } },
        { $set: { status: 'Pending' } }
      );
      console.log(`✓ Updated ${result.modifiedCount} products to Pending status`);
    }

    // Get all products with their sellers
    const products = await Product.find()
      .populate('createdBy', 'name email shopName role status')
      .populate('category', 'name')
      .lean();

    console.log(`\n=== ALL PRODUCTS (${products.length}) ===\n`);
    products.forEach((p, i) => {
      const seller = p.createdBy || {};
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   ID: ${p._id}`);
      console.log(`   Status: ${p.status}`);
      console.log(`   Seller: ${seller.name || 'Unknown'} (${seller.email || 'no-email'})`);
      console.log(`   Category: ${p.category?.name || 'Unknown'}`);
      console.log(`   Price: LKR ${p.price}`);
      console.log('');
    });

    // Summary
    console.log('=== SUMMARY ===\n');
    const byStatus = products.reduce((acc, p) => {
      acc[p.status || 'Pending'] = (acc[p.status || 'Pending'] || 0) + 1;
      return acc;
    }, {});

    const bySeller = products.reduce((acc, p) => {
      const seller = p.createdBy?.name || 'Unknown';
      if (!acc[seller]) acc[seller] = [];
      acc[seller].push(p.name);
      return acc;
    }, {});

    console.log('Status Summary:');
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    console.log('\nSeller Summary:');
    Object.entries(bySeller).forEach(([seller, items]) => {
      console.log(`  ${seller}: ${items.length} products`);
      items.forEach(name => console.log(`    - ${name}`));
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Connection closed');
  }
};

dbConnect().then(() => fixProductStatus());
