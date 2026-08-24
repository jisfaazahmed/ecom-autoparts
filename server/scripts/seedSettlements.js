/**
 * Seed script – Generate Settlement documents from existing SubOrder data.
 *
 * Usage:  cd server && node scripts/seedSettlements.js
 *
 * For each active vendor, this script creates one Settlement per calendar month
 * over the past 12 months, using aggregated SubOrder totals.  It mirrors the
 * calculation logic in SettlementService.calculateVendorSettlement() but runs
 * directly against the DB so it works even when no settlements have been created
 * yet.
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const config = require('../config/config');

// Register models before use
require('../models/user');
require('../models/order.model');
require('../models/orderItem.model');
require('../models/subOrder.model');
require('../models/refund.model');
require('../models/settlement.model');

const User = require('../models/user');
const SubOrder = require('../models/subOrder.model');
const Refund = require('../models/refund.model');
const Settlement = require('../models/settlement.model');

// ---------------------------------------------------------------------------
// Helper: build Mongo URI the same way the main server and other seeds do.
// ---------------------------------------------------------------------------
function buildMongoUri() {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const auth =
    MONGO_USER && MONGO_PASSWORD
      ? `${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASSWORD)}@`
      : '';
  return `mongodb://${auth}${MONGO_IP}:${MONGO_PORT || 27017}/${MONGO_DB}?authSource=admin`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getRandomStatus() {
  // Weighted: older settlements are mostly completed, recent ones may be pending
  const roll = Math.random();
  if (roll < 0.60) return 'completed';
  if (roll < 0.80) return 'processing';
  return 'pending';
}

/**
 * Generate an array of { startDate, endDate } objects representing each
 * calendar month from `monthsAgo` months ago up to (but not including) the
 * current month.
 */
function getMonthlyPeriods(monthsAgo = 12) {
  const periods = [];
  const now = new Date();
  for (let i = monthsAgo; i >= 1; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
    periods.push({ startDate: start, endDate: end });
  }
  return periods;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function seedSettlements() {
  const uri = buildMongoUri();
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');

    // 1. Fetch the three live-app vendors by shop name
    const TARGET_SHOPS = ['AutoZone', 'MotorHub', 'CarZone'];
    const vendors = await User.find({
      role: 'ADMIN',
      status: 'ACTIVE',
      shopName: { $in: TARGET_SHOPS },
    }).lean();
    if (vendors.length === 0) {
      console.log('❌ No matching vendors found for:', TARGET_SHOPS.join(', '));
      process.exit(0);
    }
    console.log(`👥 Found ${vendors.length} vendor(s): ${vendors.map(v => v.shopName).join(', ')}`);

    const periods = getMonthlyPeriods(12);
    let totalCreated = 0;
    let totalSkipped = 0;

    for (const vendor of vendors) {
      const vendorId = vendor._id;
      const commissionRate = vendor.commissionRate || 0;
      console.log(`\n🏪 Processing vendor: ${vendor.shopName || vendor.name} (commission ${commissionRate}%)`);

      for (const period of periods) {
        // Skip if a settlement already exists for this vendor + period
        const existing = await Settlement.findOne({
          vendor: vendorId,
          'settlementPeriod.startDate': period.startDate,
          'settlementPeriod.endDate': period.endDate,
        });
        if (existing) {
          totalSkipped++;
          continue;
        }

        // Aggregate sub-orders in this period (exclude cancelled)
        const subOrders = await SubOrder.find({
          seller: vendorId,
          createdAt: { $gte: period.startDate, $lte: period.endDate },
          status: { $ne: 'cancelled' },
        }).lean();

        // If no sub-orders in this period, skip creating a settlement
        if (subOrders.length === 0) continue;

        let totalOrderAmount = 0;
        subOrders.forEach((so) => {
          totalOrderAmount += so.totalAmount || 0;
        });

        // Aggregate refunds
        const refunds = await Refund.find({
          vendor: vendorId,
          createdAt: { $gte: period.startDate, $lte: period.endDate },
          status: { $in: ['refund_completed'] },
        }).lean();

        let totalRefunded = 0;
        refunds.forEach((r) => {
          const val = Number(r.refundAmount?.totalRefund ?? r.amount ?? 0);
          totalRefunded += Number.isFinite(val) ? val : 0;
        });

        const netOrderAmount = totalOrderAmount - totalRefunded;
        const totalCommission = (netOrderAmount * commissionRate) / 100;

        // Charges (same formula as SettlementService)
        const platformFee = Math.max(0, netOrderAmount * 0.02);
        const paymentProcessingFee = Math.max(0, netOrderAmount * 0.01);
        const totalCharges = platformFee + paymentProcessingFee;
        const payableAmount = netOrderAmount - totalCommission - totalCharges;

        const status = getRandomStatus();
        const createdAt = new Date(
          period.endDate.getTime() + 1000 * 60 * 60 * 24 * 2 // 2 days after period end
        );

        await Settlement.create({
          vendor: vendorId,
          settlementPeriod: {
            startDate: period.startDate,
            endDate: period.endDate,
          },
          ordersSummary: {
            totalOrders: subOrders.length,
            totalOrderAmount,
            totalRefunded,
            netOrderAmount,
          },
          commission: {
            rate: commissionRate,
            totalCommission,
          },
          charges: {
            platformFee,
            paymentProcessingFee,
            logisticsFee: 0,
            otherCharges: 0,
            totalCharges,
          },
          payableAmount,
          status,
          subOrders: subOrders.map((so) => so._id),
          refunds: refunds.map((r) => ({
            refundId: r._id,
            amount: Number(r.refundAmount?.totalRefund ?? r.amount ?? 0),
            date: r.createdAt,
          })),
          payoutMethod: 'bank_transfer',
          ...(status === 'completed' && {
            payoutDetails: {
              payoutDate: new Date(createdAt.getTime() + 1000 * 60 * 60 * 24 * 3),
              referenceNumber: `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            },
          }),
          createdAt,
          updatedAt: createdAt,
        });

        totalCreated++;
      }
    }

    console.log(`\n🎉 Done! Created ${totalCreated} settlement(s), skipped ${totalSkipped} existing.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding settlements:', err);
    process.exit(1);
  }
}

seedSettlements();
