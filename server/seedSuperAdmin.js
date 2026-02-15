/**
 * Seed script: creates a default Super Admin user if none exists.
 * Run once: npm run seed (or node seedSuperAdmin.js with MONGO_* env set)
 *
 * Default credentials (change in production):
 *   Email:    jisfaaz@gmail.com
 *   Password: SuperAdmin123!
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('./config/config');

const User = require('./models/user');

const DEFAULT_SUPER_ADMIN = {
  name: 'Super Admin',
  email: 'jisfaaz@gmail.com',
  password: 'SuperAdmin123!',
  role: 'SUPER_ADMIN',
  status: 'ACTIVE',
};

async function seed() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ email: DEFAULT_SUPER_ADMIN.email });
    if (existing) {
      console.log('Super Admin already exists:', existing.email);
      process.exit(0);
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(DEFAULT_SUPER_ADMIN.password, salt);

    await User.create({
      name: DEFAULT_SUPER_ADMIN.name,
      email: DEFAULT_SUPER_ADMIN.email,
      password: hashedPassword,
      role: DEFAULT_SUPER_ADMIN.role,
      status: DEFAULT_SUPER_ADMIN.status,
    });

    console.log('Super Admin created successfully.');
    console.log('Email:', DEFAULT_SUPER_ADMIN.email);
    console.log('Password:', DEFAULT_SUPER_ADMIN.password);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seed();
