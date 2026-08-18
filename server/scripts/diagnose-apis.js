require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

require('../models/user');
require('../models/order.model');
require('../models/orderItem.model');
require('../models/subOrder.model');
require('../models/product');
require('../models/refund.model');
require('../models/payment.model');

const User = require('../models/user');
const base = process.env.API_BASE || 'http://127.0.0.1:5000/api';

async function loginAsSuperAdmin() {
  const users = await User.find({ role: 'SUPER_ADMIN' });
  console.log('Super admins in DB:', users.map((u) => u.email));

  const envEmail = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const envPass = process.env.SUPER_ADMIN_PASSWORD;

  for (const user of users) {
    const ok = await bcrypt.compare(envPass, user.password).catch(() => false);
    console.log(`  ${user.email} matches env password: ${ok}`);
  }

  let user = await User.findOne({ email: envEmail });
  if (!user) user = users[0];
  if (!user) throw new Error('No super admin user');

  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(envPass, salt);
  await user.save();
  console.log('Ensured password for:', user.email);

  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: envPass }),
  });
  const text = await res.text();
  console.log('\nLOGIN', res.status, text.slice(0, 300));
  if (!res.ok) throw new Error('Login failed');
  return { token: JSON.parse(text).accessToken, email: user.email };
}

async function hit(path, token) {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  console.log(`\n[${res.status}] ${path}`);
  console.log(text.slice(0, 500));
  return res.status;
}

async function main() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  await mongoose.connect(
    `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`
  );

  try {
    const health = await fetch('http://127.0.0.1:5000/health');
    console.log('HEALTH', health.status, await health.text());
  } catch (e) {
    console.error('Server not reachable on 5000:', e.message);
    process.exit(1);
  }

  const { token, email } = await loginAsSuperAdmin();
  console.log('Logged in as', email);

  const paths = [
    '/auth/me',
    '/shops',
    '/shops?limit=100',
    '/refunds/admin/list?limit=5',
    '/admin-analytics/superadmin?range=1y',
    '/products/admin/all',
    '/categories',
    '/products',
  ];

  for (const p of paths) {
    await hit(p, token);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('DIAG FAIL', e);
  process.exit(1);
});
