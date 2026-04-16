#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');

// Load all models
const Product = require('../models/product');
const User = require('../models/user');
const Category = require('../models/category');
const Vehicle = require('../models/vehicle');

const dbConnect = async () => {
  if (mongoose.connection.readyState === 1) {
    console.log('✓ Already connected to MongoDB');
    return;
  }

  try {
    // Build connection string from env vars
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

const debugProducts = async () => {
  try {
    console.log('\n=== PRODUCT DATABASE DEBUG ===\n');

    // Get all products with populated createdBy
    const products = await Product.find()
      .populate('createdBy', 'name email shopName role status')
      .populate('category', 'name')
      .lean();

    console.log(`Total Products: ${products.length}\n`);

    if (products.length === 0) {
      console.log('No products found in database.');
      return;
    }

    // Group by status
    const byStatus = {};
    products.forEach(p => {
      const status = p.status || 'Pending';
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(p);
    });

    console.log('Products by Status:');
    Object.entries(byStatus).forEach(([status, items]) => {
      console.log(`  ${status}: ${items.length}`);
    });

    console.log('\n=== DETAILED PRODUCT LIST ===\n');

    products.forEach((product, index) => {
      const seller = product.createdBy || {};
      console.log(`${index + 1}. ${product.name}`);
      console.log(`   ID: ${product._id}`);
      console.log(`   Status: ${product.status || 'Pending'}`);
      console.log(`   Active: ${product.isActive}`);
      console.log(`   Price: LKR ${product.price}`);
      console.log(`   Stock: ${product.stock}`);
      console.log(`   SKU: ${product.sku}`);
      console.log(`   Category: ${product.category?.name || 'Unknown'}`);
      console.log(`   Seller: ${seller.name || seller.shopName || 'Unknown'} (${seller.email || 'no-email'})`);
      console.log(`   Seller Role: ${seller.role}`);
      console.log(`   Seller Status: ${seller.status || 'Unknown'}`);
      console.log(`   Created At: ${new Date(product.createdAt).toLocaleString()}`);
      console.log('');
    });

    // Summary
    console.log('=== SUMMARY ===\n');
    const sellers = new Set(products.map(p => p.createdBy?._id).filter(Boolean));
    console.log(`Total Sellers: ${sellers.size}`);
    console.log(`Total Products: ${products.length}`);
    console.log(`Pending: ${byStatus.Pending?.length || 0}`);
    console.log(`Approved: ${byStatus.Approved?.length || 0}`);
    console.log(`Rejected: ${byStatus.Rejected?.length || 0}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✓ Connection closed');
  }
};

dbConnect().then(() => debugProducts());
