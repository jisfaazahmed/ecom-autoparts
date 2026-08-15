require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require('path');

// Global handlers – must be registered before anything else so stray throws
// don't silently kill the process.
process.on('uncaughtException', (err) => {
  console.error('💥 uncaughtException – server will stay alive:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 unhandledRejection – server will stay alive:', reason);
});


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
app.use(cors());
app.use(express.json());
app.use('/labels', express.static(path.join(__dirname, 'uploads', 'labels')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

//MongoDB connection
// The deploy passes the parts (MONGO_IP/MONGO_PORT/MONGO_USER/...) rather than one
// whole URI, matching what every script in scripts/ already builds. MONGO_URI stays
// supported so local .env files and hosted Atlas/Cosmos strings keep working.
function buildMongoUri() {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;

  const { MONGO_USER, MONGO_PASSWORD, MONGO_IP, MONGO_PORT, MONGO_DB } = process.env;
  const auth = MONGO_USER && MONGO_PASSWORD
    ? `${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASSWORD)}@`
    : '';
  // authSource=admin: the root user created by MONGO_INITDB_ROOT_* lives in the
  // admin database, not in MONGO_DB.
  return `mongodb://${auth}${MONGO_IP}:${MONGO_PORT || 27017}/${MONGO_DB}?authSource=admin`;
}

if (!process.env.MONGO_URI && !process.env.MONGO_IP) {
  console.error('No MongoDB configuration found: set MONGO_URI, or MONGO_IP/MONGO_PORT/MONGO_USER/MONGO_PASSWORD/MONGO_DB.');
}

mongoose.connect(buildMongoUri()).then(() => {
  console.log('Connected to MongoDB');
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
// readyState 1 === connected. The CD gate and the image HEALTHCHECK both poll this,
// so it has to fail while MongoDB is down rather than reporting OK for a process
// that is listening but cannot serve a single data route.
app.get("/health", (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? "OK" : "DEGRADED",
    db: connected ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
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
console.log("📄 Documentation available at http://localhost:5000/api-docs");

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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));