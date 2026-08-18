const path = require('path');
// Always load server/.env so Mongo credentials are correct even when started from repo root.
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

// Global handlers – must be registered before anything else so stray throws
// don't silently kill the process.
process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException – server will stay alive:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 unhandledRejection – server will stay alive:', reason);
});

const {
  MONGO_DB,
  MONGO_USER,
  MONGO_PASSWORD,
  MONGO_IP,
  MONGO_PORT,
} = require("./config/config");

// Register core models before routes (prevents populate/aggregate "Schema not registered" crashes).
require('./models/user');
require('./models/order.model');
require('./models/orderItem.model');
require('./models/subOrder.model');
require('./models/product');
require('./models/refund.model');
require('./models/payment.model');

// === 1. Import the New Routes ===
const authRoutes = require('./routes/authRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const vendorProductRoutes = require('./routes/vendorProductRoutes');
const OrderRoutes = require('./routes/order.routes');
const cartRoutes = require('./routes/cartRoutes');
const paymentRoutes = require('./routes/payment.routes');
const shippingRoutes = require('./routes/shipping.routes');
const refundRoutes = require('./routes/refund.routes');
const addressRoutes = require('./routes/address.routes');
const couponRoutes = require('./routes/coupon.routes');
const settlementRoutes = require('./routes/settlement.routes');
const shopRoutes = require('./routes/shopRoutes');
const policyRoutes = require('./routes/policy.routes');
const notificationRoutes = require('./routes/notificationRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const adminAnalyticsRoutes = require('./routes/adminAnalytics.routes');
const userRoutes = require('./routes/user.routes');
const uploadRoutes = require('./routes/upload.routes');
const wishlistRoutes = require('./routes/wishlist.routes');
const BackgroundJobs = require('./jobs/backgroundJobs');
const swaggerUI = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// === IMPORTANT: Stripe webhook needs raw body before json parsing ===
// Apply raw body parsing ONLY for webhook endpoint
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Apply JSON parsing for all other routes
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      process.env.CLIENT_URL,
    ].filter(Boolean),
    credentials: true,
  })
);
app.use(express.json());
app.use('/labels', express.static(path.join(__dirname, 'uploads', 'labels')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//MongoDB connection
mongoose.connect(`mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`).then(() => {
  console.log(`Connected to MongoDB (${MONGO_DB} @ ${MONGO_IP}:${MONGO_PORT})`);
  // Initialize background jobs after DB connection
  BackgroundJobs.initializeJobs();
}).catch((err) => {
  console.error('Error connecting to MongoDB:', err);
});

// Test API route
app.get("/api/message", (req, res) => {
  res.json({ message: "Hello from Express Backend! working" });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    database: MONGO_DB,
    mongoHost: MONGO_IP,
    mongoPort: MONGO_PORT,
  });
});

// Root API endpoint
app.get("/", (req, res) => {
  res.json({
    name: "E-Commerce Autoparts API",
    version: "1.0.0",
    status: "running",
    documentation: "http://localhost:5000/api-docs"
  });
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
app.use('/api/payments', paymentRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/admin-analytics', adminAnalyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpecs));

// Return a consistent payload for unknown API routes.
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'Route not found' });
  }
  next();
});

// Centralized API error formatter.
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT);