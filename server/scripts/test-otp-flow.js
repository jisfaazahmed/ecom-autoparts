require('dotenv').config();
const mongoose = require('mongoose');
const config = require('../config/config');
const User = require('../models/user');
const { execSync } = require('child_process');

async function runTest() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const testEmail = 'testvendor123@example.com';

    // Cleanup any existing test user first
    await User.deleteMany({ email: testEmail });
    console.log('Cleaned up previous test vendor accounts.');

    // 1. Start registration
    console.log('Starting registration for test vendor...');
    const registerStartResponse = await fetch('http://localhost:5000/api/auth/register/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Vendor',
        email: testEmail,
        password: 'password123',
        role: 'ADMIN',
        shopName: 'Test Shop'
      })
    });

    const startResult = await registerStartResponse.json();
    if (!registerStartResponse.ok) {
      throw new Error(`Register start failed: ${JSON.stringify(startResult)}`);
    }

    const { verificationId } = startResult;
    console.log(`Registration started. Verification ID: ${verificationId}`);

    // Wait a brief moment for container logs to be updated
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 2. Fetch the OTP from container logs
    console.log('Fetching OTP from container logs...');
    // Run docker compose logs to find the OTP
    const logs = execSync('docker compose -f ../docker-compose.dev.yml logs server --tail 100').toString();
    
    // Search for the 6-digit OTP inside the styled HTML log block
    // Specifically looking for 6 digits inside a line following the message "Use this code to complete your signup:"
    const otpMatch = logs.match(/(\d{6})/g);
    if (!otpMatch) {
      throw new Error('Could not find 6-digit OTP in the logs');
    }

    // Get the most recent OTP from the logs
    const otp = otpMatch[otpMatch.length - 1];
    console.log(`Found OTP in logs: ${otp}`);

    // 3. Verify OTP
    console.log(`Verifying OTP: ${otp} for Verification ID: ${verificationId}...`);
    const verifyResponse = await fetch('http://localhost:5000/api/auth/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationId,
        otp
      })
    });

    const verifyResult = await verifyResponse.json();
    if (!verifyResponse.ok) {
      throw new Error(`OTP verification failed: ${JSON.stringify(verifyResult)}`);
    }

    console.log('OTP Verification Result:', verifyResult);

    // 4. Validate DB State for the vendor
    const verifiedUser = await User.findById(verificationId);
    console.log('--- DB State Validation ---');
    console.log(`User Found: ${verifiedUser ? 'Yes' : 'No'}`);
    console.log(`Email Verified At: ${verifiedUser.emailVerification.verifiedAt}`);
    console.log(`Role: ${verifiedUser.role}`);
    console.log(`Status: ${verifiedUser.status}`);
    console.log(`Shop Name: ${verifiedUser.shopName}`);

    if (verifiedUser.role !== 'ADMIN') {
      throw new Error(`Expected role to be ADMIN, got: ${verifiedUser.role}`);
    }
    if (verifiedUser.status !== 'PENDING') {
      throw new Error(`Expected status to be PENDING (since it is a vendor waiting for approval), got: ${verifiedUser.status}`);
    }
    if (!verifiedUser.emailVerification.verifiedAt) {
      throw new Error('Expected emailVerification.verifiedAt to be set.');
    }

    console.log('\n✅ Vendor Registration and OTP Verification flow checked successfully!');

    // Cleanup
    await User.deleteMany({ email: testEmail });
    console.log('Cleaned up test vendor account.');
    process.exit(0);

  } catch (err) {
    console.error('❌ Test failed:', err.message || err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

runTest();
