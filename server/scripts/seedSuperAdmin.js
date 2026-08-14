/**
 * Seed script: creates a default Super Admin user if none exists.
 * Credentials come from env (never hardcode in repo).
 *
 * Required env (e.g. in server/.env or shell):
 *   SUPER_ADMIN_EMAIL=your@email.com
 *   SUPER_ADMIN_PASSWORD=your-secure-password
 *
 * Run: npm run seed   (with MONGO_* and above vars set)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/config');

const User = require('../models/user');

const email = process.env.SUPER_ADMIN_EMAIL;
const password = process.env.SUPER_ADMIN_PASSWORD;

if (!email || !password) {
  console.error(
    'Missing env: set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD (e.g. in server/.env).'
  );
  process.exit(1);
}

const superAdmin = {
  name: 'Super Admin',
  email: email.trim(),
  password,
  role: 'SUPER_ADMIN',
  status: 'ACTIVE',
};

async function seed() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ email: superAdmin.email });
    if (existing) {
      console.log('Super Admin already exists:', existing.email);
      process.exit(0);
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(superAdmin.password, salt);

    await User.create({
      name: superAdmin.name,
      email: superAdmin.email,
      password: hashedPassword,
      role: superAdmin.role,
      status: superAdmin.status,
    });

    console.log('Super Admin created successfully.');
    console.log('Email:', superAdmin.email);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seed();
