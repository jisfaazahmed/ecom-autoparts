const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/user');

// Import your config to get the correct credentials
const {
  MONGO_DB,
  MONGO_USER,
  MONGO_PASSWORD,
  MONGO_IP,
  MONGO_PORT,
} = require("./config/config");

// Construct the same secure URL used in index.js
const mongoURL = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

mongoose.connect(mongoURL)
  .then(() => seed())
  .catch(err => {
    console.error('Seeder Connection Error:', err);
    process.exit(1);
  });

const seed = async () => {
  const email = 'jisfaaz@gmail.com'; // CHANGE THIS
  const password = 'Jisfaaz@1';         // CHANGE THIS

  // Check if exists
  const exists = await User.findOne({ email });
  if (exists) {
    console.log('Super Admin already exists.');
    process.exit();
  }

  // Hash Password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create User
  const admin = new User({
    name: 'Super Admin',
    email,
    password: hashedPassword,
    role: 'SUPER_ADMIN',
    status: 'ACTIVE'
  });

  await admin.save();
  console.log('Super Admin Created Successfully!');
  process.exit();
};