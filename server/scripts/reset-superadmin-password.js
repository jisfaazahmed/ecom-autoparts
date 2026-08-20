/**
 * Reset password for the super admin account in MongoDB.
 * Uses SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD from server/.env
 *
 * Usage: node scripts/reset-superadmin-password.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config/config');
const User = require('../models/user');

const email = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.SUPER_ADMIN_PASSWORD;

async function run() {
  if (!email || !password) {
    console.error('Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in server/.env');
    process.exit(1);
  }

  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
  await mongoose.connect(uri);

  let user = await User.findOne({ email });
  if (!user) {
    const fallback = await User.findOne({ role: 'SUPER_ADMIN' });
    if (fallback) {
      console.log(`No user for ${email}; updating existing super admin: ${fallback.email}`);
      user = fallback;
    }
  }

  if (!user) {
    console.error('No SUPER_ADMIN user found. Run: npm run seed');
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(password, salt);
  user.role = 'SUPER_ADMIN';
  user.status = 'ACTIVE';
  await user.save();

  console.log(`Super admin password updated for: ${user.email}`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
