require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const config = require('../config/config');

async function run() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
  console.log('DB:', MONGO_DB, '@', MONGO_IP);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const productGroups = await db.collection('products').aggregate([
    { $group: { _id: { status: '$status', isActive: '$isActive' }, count: { $sum: 1 } } },
  ]).toArray();
  console.log('\nProduct status groups:', JSON.stringify(productGroups, null, 2));

  const totalProducts = await db.collection('products').countDocuments();
  const approvedActive = await db.collection('products').countDocuments({ status: 'Approved', isActive: true });
  console.log(`\nTotal products: ${totalProducts}, Approved+active: ${approvedActive}`);

  const users = await db.collection('users').find({}, { projection: { email: 1, role: 1, status: 1 } }).toArray();
  console.log('\nUsers:', JSON.stringify(users, null, 2));

  const orders = await db.collection('orders').countDocuments().catch(() => 0);
  const ordermodels = await db.collection('ordermodels').countDocuments().catch(() => 0);
  console.log('\norders collection:', orders, 'ordermodels:', ordermodels);

  const bySeller = await db.collection('products').aggregate([
    { $group: { _id: '$createdBy', count: { $sum: 1 } } },
  ]).toArray();
  console.log('\nProducts per createdBy:', JSON.stringify(bySeller, null, 2));

  const featured = await db.collection('products').countDocuments({ featured: true, status: 'Approved', isActive: true });
  console.log('Featured (approved+active):', featured);

  await mongoose.disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
