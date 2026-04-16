#!/usr/bin/env node
require('dotenv').config();
const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:5000/api';

// Test user - superadmin
const testSuperAdmin = {
  email: 'superadmin@example.com',
  password: 'password123',
  token: null
};

const api = axios.create({
  baseURL: API_URL,
  validateStatus: () => true, // Don't throw on any status
});

const test = async () => {
  try {
    console.log('\n=== API ENDPOINT TEST ===\n');
    console.log(`API Base URL: ${API_URL}\n`);

    // 1. Try to login as superadmin (or use a test token)
    console.log('1️⃣  Testing GET /products/admin/all (without auth - should fail)');
    let response = await api.get('/products/admin/all');
    console.log(`   Status: ${response.status}`);
    console.log(`   Message: ${response.data?.message || response.statusText}\n`);

    // 2. Try to fetch all products (public endpoint)
    console.log('2️⃣  Testing GET /products (public endpoint)');
    response = await api.get('/products');
    console.log(`   Status: ${response.status}`);
    if (Array.isArray(response.data)) {
      console.log(`   Found ${response.data.length} products`);
      if (response.data.length > 0) {
        response.data.slice(0, 3).forEach((p, i) => {
          console.log(`     ${i + 1}. ${p.name} (Status: ${p.status})`);
        });
      }
    } else if (response.data?.data) {
      console.log(`   Found ${response.data.data.length} products`);
      if (response.data.data.length > 0) {
        response.data.data.slice(0, 3).forEach((p, i) => {
          console.log(`     ${i + 1}. ${p.name} (Status: ${p.status})`);
        });
      }
    } else {
      console.log(`   Response:`, response.data);
    }
    console.log('');

    // 3. Try to fetch product by ID
    console.log('3️⃣  Testing GET /products/:id (public endpoint)');
    response = await api.get('/products/69df18a65eb31c033c43546d');
    console.log(`   Status: ${response.status}`);
    if (response.status === 200) {
      console.log(`   Product: ${response.data.name} (Status: ${response.data.status})`);
    } else {
      console.log(`   Message: ${response.data?.message || response.statusText}`);
    }
    console.log('');

    // 4. Check if server is accessible
    console.log('4️⃣  Testing server health');
    response = await api.get('/auth/profile');
    console.log(`   Status: ${response.status}`);
    console.log(`   Message: ${response.data?.message || 'OK'}\n`);

    console.log('✓ API is accessible and responding');

  } catch (error) {
    console.error('Error:', error.message);
  }
};

test();
