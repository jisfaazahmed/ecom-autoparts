require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const slugify = require('slugify');
const config = require('../config/config');

const Category = require('../models/category');
const Product = require('../models/product');
const User = require('../models/user');
const Order = require('../models/order.model');
const SubOrder = require('../models/subOrder.model');
const OrderItem = require('../models/orderItem.model');

// User data from the prompt
const USERS_DATA = [
  {
    "_id": "6a8573f529c5c562e87a5b70",
    "name": "roshanvm",
    "email": "roshan.mohamed0619@gmail.com",
    "role": "ADMIN",
    "status": "ACTIVE",
    "shopName": "second"
  },
  {
    "_id": "6a8709f6cd29ee01e22d4c6a",
    "name": "Jisfaaz Ahmed",
    "email": "jisfaaz@gmail.com",
    "phone": "+94771272725",
    "role": "ADMIN",
    "status": "ACTIVE",
    "shopName": "AUTOZONE"
  },
  {
    "_id": "6a870c8ccd29ee01e22d5059",
    "name": "Abdhullah",
    "email": "abdnou076@gmail.com",
    "phone": "+94 762977776",
    "role": "ADMIN",
    "status": "ACTIVE",
    "shopName": "CarZone"
  },
  {
    "_id": "6a87223a997d132b710b9b96",
    "name": "Arthur Morgan",
    "email": "arthurmorgan22334@gmail.com",
    "phone": "+94771234567",
    "role": "ADMIN",
    "status": "ACTIVE",
    "shopName": "Hybrid Hub"
  },
  {
    "_id": "6a87282d997d132b710ba0e2",
    "name": "Tharin",
    "email": "tharin@gmail.com",
    "phone": "0771234567",
    "role": "ADMIN",
    "status": "ACTIVE",
    "shopName": "MotorHub"
  }
];

const CATEGORIES = [
  'Engine Components',
  'Brakes & Suspension',
  'Interior Accessories',
  'Exterior Body Parts',
  'Lighting & Electrical',
  'Wheels & Tires'
];

const ORDER_STATUSES = [
  'delivered', 'delivered', 'delivered', 'delivered', 'delivered', // 50% chance delivered
  'shipped', 'out_for_delivery', 'pending', 'cancelled', 'returned'
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomDateWithinLastYear() {
  const now = new Date();
  const pastYear = new Date();
  pastYear.setFullYear(now.getFullYear() - 1);
  return new Date(pastYear.getTime() + Math.random() * (now.getTime() - pastYear.getTime()));
}

async function seedData() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    // 1. Seed Categories
    console.log('📦 Seeding Categories...');
    const categoryDocs = [];
    for (const catName of CATEGORIES) {
      const slug = slugify(catName, { lower: true });
      let category = await Category.findOne({ slug });
      if (!category) {
        category = await Category.create({ name: catName, slug, description: `${catName} description` });
      }
      categoryDocs.push(category);
    }

    // 2. Fetch existing vendors from the database based on the provided list
    console.log('👥 Fetching active vendors...');
    const targetEmails = USERS_DATA.filter(u => u.role === 'ADMIN').map(u => u.email);
    const vendors = await User.find({ email: { $in: targetEmails }, role: 'ADMIN', status: 'ACTIVE' });

    if (vendors.length === 0) {
      console.log('❌ No active vendors found matching the provided list. Please check the live site database.');
      process.exit(1);
    }

    console.log(`Found ${vendors.length} active vendors to seed data for.`);

    // Create a mock customer for orders
    let mockCustomer = await User.findOne({ email: 'mock_customer_buyer@example.com' });
    if (!mockCustomer) {
      mockCustomer = await User.create({
        name: 'Mock Customer',
        email: 'mock_customer_buyer@example.com',
        password: 'hashed_dummy_password',
        role: 'CUSTOMER',
        status: 'ACTIVE',
        phone: '1234567890'
      });
    }

    const vendors = await User.find({ role: 'ADMIN', status: 'ACTIVE' });
    console.log(`Found ${vendors.length} active vendors.`);

    // 3. Seed Products for each Vendor (6 each)
    console.log('🛍️ Seeding Products...');
    const vendorProductsMap = {}; // vendorId -> [Products]

    for (const vendor of vendors) {
      vendorProductsMap[vendor._id] = [];
      for (let i = 0; i < CATEGORIES.length; i++) {
        const cat = categoryDocs[i];
        const pName = `${vendor.shopName || vendor.name} - ${cat.name} Premium Item`;
        const slug = slugify(pName, { lower: true }) + '-' + Math.random().toString(36).substr(2, 5);
        
        const price = getRandomInt(1000, 25000); // 10 to 250 LKR/USD logic
        
        let product = await Product.findOne({ sku: `SKU-${vendor._id}-${i}` });
        if (!product) {
          product = await Product.create({
            name: pName,
            slug,
            description: `High quality ${cat.name} provided by ${vendor.shopName}.`,
            price,
            stock: getRandomInt(50, 500),
            sku: `SKU-${vendor._id}-${i}`,
            partNumber: `PN-${vendor._id}-${i}`,
            category: cat._id,
            isActive: true,
            status: 'Approved',
            createdBy: vendor._id,
            image: 'https://images.unsplash.com/photo-1550524451-b8449c28859a?auto=format&fit=crop&w=500&q=60'
          });
        }
        vendorProductsMap[vendor._id].push(product);
      }
    }

    // 4. Seed Historical Orders (75-100 per vendor)
    console.log('🛒 Seeding Historical Orders...');
    let totalOrdersCreated = 0;

    for (const vendor of vendors) {
      const vendorProducts = vendorProductsMap[vendor._id];
      if (vendorProducts.length === 0) continue;

      const numOrders = getRandomInt(75, 100);
      console.log(`Creating ${numOrders} orders for vendor: ${vendor.shopName || vendor.name}`);

      for (let i = 0; i < numOrders; i++) {
        const orderDate = getRandomDateWithinLastYear();
        const orderStatus = getRandomItem(ORDER_STATUSES);
        
        // Pick 1-3 random products from this vendor
        const numItems = getRandomInt(1, 3);
        const orderItemsDocs = [];
        let itemsTotal = 0;

        for (let j = 0; j < numItems; j++) {
          const product = getRandomItem(vendorProducts);
          const quantity = getRandomInt(1, 4);
          const price = product.price;
          const finalPrice = price * quantity;
          itemsTotal += finalPrice;

          const orderItem = await OrderItem.create({
            product: product._id,
            vendor: vendor._id,
            name: product.name,
            image: product.image,
            quantity,
            price,
            finalPrice,
            status: orderStatus,
            statusHistory: [{ status: orderStatus, timestamp: orderDate }]
          });
          orderItemsDocs.push(orderItem);
        }

        const shippingCharges = 500;
        const totalAmount = itemsTotal + shippingCharges;

        // Create Main Order
        // To avoid unique index issues with orderNumber, just use timestamp + random
        const orderNumber = `ORD-H-${orderDate.getTime()}-${Math.floor(Math.random()*1000)}`;
        
        const order = await Order.create({
          orderNumber,
          user: mockCustomer._id,
          items: orderItemsDocs.map(item => item._id),
          itemsTotal,
          shippingCharges,
          totalAmount,
          paymentMethod: getRandomItem(['card', 'cod']),
          paymentStatus: orderStatus === 'cancelled' ? 'failed' : 'completed',
          overallStatus: orderStatus,
          createdAt: orderDate,
          updatedAt: orderDate,
          shippingAddress: {
            fullName: mockCustomer.name,
            phone: '1234567890',
            addressLine1: '123 Mock Street',
            city: 'Mock City',
            postalCode: '12345',
            country: 'Mock Country'
          }
        });

        // Create SubOrder (Required for analytics)
        await SubOrder.create({
          order: order._id,
          seller: vendor._id,
          customer: mockCustomer._id,
          items: orderItemsDocs.map(item => item._id),
          status: orderStatus,
          paymentStatus: order.paymentStatus,
          subtotal: itemsTotal,
          shippingCharge: shippingCharges,
          totalAmount,
          createdAt: orderDate,
          updatedAt: orderDate,
          shippingAddress: order.shippingAddress,
          shippingMethod: 'standard'
        });

        // Push suborder into the Order object manually (as per model)
        await Order.updateOne({ _id: order._id }, {
          $push: {
            subOrders: {
              vendor: vendor._id,
              items: orderItemsDocs.map(item => item._id),
              status: orderStatus,
              subtotal: itemsTotal,
              updatedAt: orderDate
            }
          }
        });

        totalOrdersCreated++;
      }
    }

    console.log(`🎉 Successfully seeded ${totalOrdersCreated} historical orders!`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding historical data:', error);
    process.exit(1);
  }
}

seedData();
