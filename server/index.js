require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const {
  MONGO_DB,
  MONGO_USER,
  MONGO_PASSWORD,
  MONGO_IP,
  MONGO_PORT,
} = require("./config/config");

// === 1. Import the New Routes ===
const authRoutes = require('./routes/authRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const vendorProductRoutes = require('./routes/vendorProductRoutes');
const OrderRoutes = require('./routes/order.routes');
const cartRoutes = require('./routes/cartRoutes');

const swaggerUI = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

const app = express();
app.use(cors());
app.use(express.json());

//MongoDB connection
mongoose.connect(`mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});

// Test API route
app.get("/api/message", (req, res) => {
  res.json({ message: "Hello from Express Backend! working" });
});

// === Use the Routes ===
app.use('/api/auth', authRoutes);       //   & Register
app.use('/api/vendors', vendorRoutes);  // Vendor Approval
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/offers', vendorProductRoutes);
app.use('/api/orders', OrderRoutes);  // Order Management
app.use('/api/cart', cartRoutes);

app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpecs));
console.log("📄 Documentation available at http://localhost:5000/api-docs");

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));