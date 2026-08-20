/**
 * Approve a vendor (ADMIN user) by email.
 * Usage: node scripts/approve-vendor.js vendor@example.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const config = require('../config/config');
const User = require('../models/user');

const email = String(process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Usage: node scripts/approve-vendor.js <vendor-email>');
  process.exit(1);
}

async function run() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
  await mongoose.connect(uri);

  const user = await User.findOne({ email, role: 'ADMIN' });
  if (!user) {
    console.error(`No vendor (ADMIN) found for: ${email}`);
    process.exit(1);
  }

  user.status = 'ACTIVE';
  await user.save();
  console.log(`Approved vendor: ${user.email} (${user.shopName || 'no shop name'})`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
