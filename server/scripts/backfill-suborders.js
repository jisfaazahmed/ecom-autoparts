require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../models/order.model');
const OrderItem = require('../models/orderItem.model');
const SubOrder = require('../models/subOrder.model');
const orderService = require('../services/order.service');
const {
  MONGO_DB,
  MONGO_USER,
  MONGO_PASSWORD,
  MONGO_IP,
  MONGO_PORT,
} = require('../config/config');

function parseArgs() {
  const args = process.argv.slice(2);
  const has = (flag) => args.includes(flag);
  const getValue = (flag) => {
    const index = args.findIndex((arg) => arg === flag);
    if (index === -1) return null;
    return args[index + 1] || null;
  };

  return {
    dryRun: has('--dry-run'),
    onlyMissing: has('--only-missing'),
    limit: Number(getValue('--limit')) || 0,
  };
}

function groupOrderItemsBySeller(orderItems) {
  const grouped = new Map();

  for (const item of orderItems) {
    const sellerId = String(item.vendor || '').trim();
    if (!sellerId) continue;

    if (!grouped.has(sellerId)) {
      grouped.set(sellerId, {
        vendor: sellerId,
        items: [],
        status: 'pending',
        subtotal: 0,
        updatedAt: new Date(),
      });
    }

    const group = grouped.get(sellerId);
    group.items.push(item._id);
    group.subtotal += Number(item.finalPrice || item.price * item.quantity || 0);
  }

  return Array.from(grouped.values());
}

async function main() {
  const { dryRun, onlyMissing, limit } = parseArgs();

  const mongoUri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
  await mongoose.connect(mongoUri);

  const query = {};
  const orderCursor = Order.find(query)
    .select('_id user items subOrders itemsTotal shippingCharges taxAmount discountAmount paymentStatus shippingAddress shippingMethod estimatedDeliveryDate courierPartner')
    .sort({ createdAt: -1 })
    .cursor();

  let scanned = 0;
  let migrated = 0;
  let skipped = 0;
  let missingVendorOrders = 0;

  for await (const order of orderCursor) {
    if (limit > 0 && scanned >= limit) break;
    scanned += 1;

    if (!order.items?.length) {
      skipped += 1;
      continue;
    }

    const existingCount = await SubOrder.countDocuments({ order: order._id });
    if (onlyMissing && existingCount > 0) {
      skipped += 1;
      continue;
    }

    const orderItems = await OrderItem.find({ _id: { $in: order.items } })
      .select('_id vendor finalPrice price quantity status');

    const grouped = groupOrderItemsBySeller(orderItems);

    if (!grouped.length) {
      missingVendorOrders += 1;
      skipped += 1;
      continue;
    }

    if (dryRun) {
      migrated += 1;
      continue;
    }

    await orderService.persistSubOrders(order, grouped);

    // Keep embedded subOrders aligned for legacy reads.
    order.subOrders = grouped;
    await order.save();

    migrated += 1;
  }

  console.log('Backfill completed');
  console.log(`Scanned orders: ${scanned}`);
  console.log(`Migrated orders: ${migrated}`);
  console.log(`Skipped orders: ${skipped}`);
  console.log(`Orders with missing seller assignment: ${missingVendorOrders}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Backfill failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_error) {
    // no-op
  }
  process.exit(1);
});
