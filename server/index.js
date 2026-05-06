require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require('path');
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
const BackgroundJobs = require('./jobs/backgroundJobs');
const swaggerUI = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

const app = express();

// === IMPORTANT: Stripe webhook needs raw body before json parsing ===
// Apply raw body parsing ONLY for webhook endpoint
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Apply JSON parsing for all other routes
app.use(cors());
app.use(express.json());
app.use('/labels', express.static(path.join(__dirname, 'uploads', 'labels')));

//MongoDB connection
mongoose.connect(`mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`).then(() => {
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
app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(swaggerSpecs));
console.log("📄 Documentation available at http://localhost:5000/api-docs");

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));