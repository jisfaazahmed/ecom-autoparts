#!/usr/bin/env node
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/user');
const Product = require('../models/product');
const Category = require('../models/category');

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

const testEndpoint = async () => {
  try {
    console.log('\n=== TEST SUPERADMIN ENDPOINT ===\n');

    // Get all users to find superadmin
    const users = await User.find().select('name email role status');
    console.log('All Users:');
    users.forEach((u, i) => {
      console.log(`  ${i + 1}. ${u.name} (${u.email}) - Role: ${u.role}, Status: ${u.status}`);
    });

    // Get superadmin user
    const superadminUsers = await User.find({ role: 'SUPERADMIN' });
    console.log(`\n✓ Found ${superadminUsers.length} superadmin users`);
    
    if (superadminUsers.length === 0) {
      console.log('⚠️  No superadmin users found. Creating test superadmin...');
      const testAdmin = await User.create({
        name: 'Super Admin',
        email: 'superadmin@test.com',
        password: 'hashed_password',
        role: 'SUPERADMIN',
        status: 'ACTIVE',
        shopName: 'Admin Shop'
      });
      console.log(`✓ Created superadmin: ${testAdmin.email}`);
    }

    // Test getSuperAdminProducts query (simulate what the API does)
    console.log('\n=== SIMULATING getSuperAdminProducts ===\n');
    
    const query = {}; // No filters - get all
    
    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('createdBy', 'name shopName email status role')
      .populate('compatibleVehicles', 'year make model')
      .lean();

    console.log(`✓ Query returned ${products.length} products\n`);
    
    if (products.length > 0) {
      console.log('Products:');
      products.forEach((p, i) => {
        const seller = p.createdBy || {};
        console.log(`  ${i + 1}. ${p.name}`);
        console.log(`     Status: ${p.status}`);
        console.log(`     Seller: ${seller.name || 'Unknown'}`);
        console.log(`     Category: ${p.category?.name || 'Unknown'}`);
      });
    }

    // Summary by status
    console.log('\n=== STATUS SUMMARY ===\n');
    const byStatus = {};
    products.forEach(p => {
      const status = p.status || 'Pending';
      byStatus[status] = (byStatus[status] || 0) + 1;
    });

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

dbConnect().then(() => testEndpoint());
