const mongoose = require('mongoose');
const User = require('./models/user');
require('dotenv').config();
const config = require('./config/config');

async function listUsers() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

  try {
    await mongoose.connect(uri);
    const users = await User.find({}, 'email role status');
    console.log(JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Failed:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

listUsers();
