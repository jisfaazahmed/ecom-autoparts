#!/usr/bin/env node

/**
 * Test Script for Notification System and Inventory Reservation
 * Run: node scripts/test-notifications-inventory.js
 */

const mongoose = require('mongoose');
require('dotenv').config();
const {
  MONGO_DB,
  MONGO_USER,
  MONGO_PASSWORD,
  MONGO_IP,
  MONGO_PORT,
} = require('../config/config');

const NotificationService = require('../services/notification.service');
const InventoryReservationService = require('../services/inventoryReservation.service');
const Product = require('../models/product');
const User = require('../models/user');

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

async function test(name, fn) {
  try {
    await fn();
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASS' });
    console.log(`✓ ${name}`);
  } catch (error) {
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAIL', error: error.message });
    console.error(`✗ ${name}: ${error.message}`);
  }
}

async function connectDB() {
  try {
    // Try Docker connection first, then localhost
    const mongoUrl = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
    const localhostUrl = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@localhost:27017/${MONGO_DB}?authSource=admin`;
    
    try {
      await mongoose.connect(mongoUrl);
      console.log(`✓ Connected to MongoDB (Docker: ${MONGO_IP})\n`);
    } catch (dockerError) {
      console.log(`⚠ Docker connection failed, trying localhost...`);
      await mongoose.connect(localhostUrl);
      console.log('✓ Connected to MongoDB (localhost)\n');
    }
  } catch (error) {
    console.error('✗ Failed to connect to MongoDB:', error.message);
    console.error('Make sure MongoDB is running on port 27017 or Docker containers are running');
    process.exit(1);
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('TESTING NOTIFICATION SYSTEM & INVENTORY RESERVATION');
  console.log('='.repeat(60) + '\n');

  // Get a test user
  let testUser = await User.findOne({ role: 'customer' });
  if (!testUser) {
    console.warn('⚠ No customer user found. Using admin or creating mock user data.');
    testUser = await User.findOne();
  }
  const userId = testUser?._id || new mongoose.Types.ObjectId();

  // Get a test product
  let testProduct = await Product.findOne({ stock: { $gt: 0 } });
  if (!testProduct) {
    console.warn('⚠ No product with stock found. Some inventory tests may fail.');
  }
  const productId = testProduct?._id || new mongoose.Types.ObjectId();

  console.log('📋 TEST SETUP:');
  console.log(`  User ID: ${userId}`);
  console.log(`  Product ID: ${productId}\n`);

  // ========== NOTIFICATION TESTS ==========
  console.log('\n' + '='.repeat(60));
  console.log('NOTIFICATION SYSTEM TESTS');
  console.log('='.repeat(60) + '\n');

  let notificationId;

  await test('Create notification', async () => {
    const notification = await NotificationService.createNotification(userId, 'order_placed', {
      orderId: new mongoose.Types.ObjectId(),
      orderNumber: 'ORD-TEST-001'
    });
    notificationId = notification._id;
    if (!notificationId) throw new Error('Notification ID not created');
  });

  await test('Get user notifications', async () => {
    const result = await NotificationService.getUserNotifications(userId, 1, 10);
    if (!result.notifications || result.notifications.length === 0) {
      throw new Error('No notifications returned');
    }
  });

  await test('Get unread count', async () => {
    const count = await NotificationService.getUnreadCount(userId);
    if (typeof count !== 'number') throw new Error('Invalid count returned');
    console.log(`    Unread notifications: ${count}`);
  });

  await test('Mark notification as read', async () => {
    if (!notificationId) throw new Error('No notification to mark as read');
    const updated = await NotificationService.markAsRead(notificationId, userId);
    if (!updated.isRead) throw new Error('Notification not marked as read');
  });

  await test('Mark all notifications as read', async () => {
    const result = await NotificationService.markAllAsRead(userId);
    if (result.modifiedCount === undefined) throw new Error('Invalid result');
  });

  await test('Create refund initiated notification', async () => {
    const order = { _id: new mongoose.Types.ObjectId(), user: userId, orderNumber: 'ORD-REF-001' };
    const refund = { _id: new mongoose.Types.ObjectId() };
    await NotificationService.notifyRefundInitiated(order, refund, 5000);
  });

  await test('Create refund completed notification', async () => {
    const order = { _id: new mongoose.Types.ObjectId(), user: userId, orderNumber: 'ORD-REF-002' };
    const refund = { _id: new mongoose.Types.ObjectId() };
    await NotificationService.notifyRefundCompleted(order, refund, 5000);
  });

  // ========== INVENTORY RESERVATION TESTS ==========
  console.log('\n' + '='.repeat(60));
  console.log('INVENTORY RESERVATION SYSTEM TESTS');
  console.log('='.repeat(60) + '\n');

  let reservationId;

  await test('Reserve stock for product', async () => {
    if (!testProduct) throw new Error('No test product available');
    const reservation = await InventoryReservationService.reserveStock(productId, userId, 2);
    reservationId = reservation._id;
    if (!reservationId) throw new Error('Reservation ID not created');
  });

  await test('Check stock availability', async () => {
    if (!testProduct) throw new Error('No test product available');
    const available = await InventoryReservationService.checkStockAvailability(productId, 1);
    if (typeof available !== 'boolean') throw new Error('Invalid availability check');
    console.log(`    Stock available: ${available}`);
  });

  await test('Get available stock', async () => {
    if (!testProduct) throw new Error('No test product available');
    const available = await InventoryReservationService.getAvailableStock(productId);
    if (typeof available !== 'number') throw new Error('Invalid stock count');
    console.log(`    Available stock: ${available}`);
  });

  await test('Get stock summary', async () => {
    if (!testProduct) throw new Error('No test product available');
    const summary = await InventoryReservationService.getStockSummary(productId);
    if (!summary.totalStock || summary.available === undefined) {
      throw new Error('Invalid stock summary');
    }
    console.log(`    Summary: Total=${summary.totalStock}, Reserved=${summary.reserved}, Available=${summary.available}`);
  });

  await test('Get user reservations', async () => {
    const reservations = await InventoryReservationService.getUserReservations(userId);
    if (!Array.isArray(reservations)) throw new Error('Invalid result type');
    console.log(`    User reservations: ${reservations.length}`);
  });

  await test('Confirm reservation', async () => {
    if (!reservationId) throw new Error('No reservation to confirm');
    const orderId = new mongoose.Types.ObjectId();
    const confirmed = await InventoryReservationService.confirmReservation(reservationId, orderId);
    if (confirmed.status !== 'confirmed') throw new Error('Reservation not confirmed');
  });

  await test('Release reservation', async () => {
    const reservation = await InventoryReservationService.reserveStock(productId, userId, 1);
    const released = await InventoryReservationService.releaseReservation(reservation._id);
    if (released.status !== 'released') throw new Error('Reservation not released');
  });

  await test('Release expired reservations', async () => {
    const result = await InventoryReservationService.releaseExpiredReservations();
    if (result.modifiedCount === undefined) throw new Error('Invalid result');
    console.log(`    Expired reservations released: ${result.modifiedCount}`);
  });

  // ========== SUMMARY ==========
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✓ Passed: ${testResults.passed}`);
  console.log(`✗ Failed: ${testResults.failed}`);
  console.log(`Total: ${testResults.passed + testResults.failed}\n`);

  if (testResults.failed > 0) {
    console.log('Failed Tests:');
    testResults.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  ✗ ${t.name}: ${t.error}`);
    });
  }

  console.log('\n✓ Testing complete!');
}

async function main() {
  try {
    await connectDB();
    await runTests();
  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(testResults.failed > 0 ? 1 : 0);
  }
}

main();
