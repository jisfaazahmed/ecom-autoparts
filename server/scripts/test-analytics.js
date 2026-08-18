require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const config = require('../config/config');

async function main() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
  await mongoose.connect(uri);

  const SubOrder = require('../models/subOrder.model');
  const Refund = require('../models/refund.model');

  const count = await SubOrder.countDocuments();
  console.log('suborders:', count);

  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);

  try {
    const subOrders = await SubOrder.find({
      createdAt: { $gte: startDate },
      status: { $ne: 'cancelled' },
    }).populate('seller', 'commissionRate');
    console.log('subOrders found:', subOrders.length);
    subOrders.forEach((so) => {
      const period = so.createdAt.toISOString().slice(0, 7);
      console.log(' period ok', period);
    });
  } catch (e) {
    console.error('subOrder find failed:', e.message);
  }

  try {
    const refunds = await Refund.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['COMPLETED', 'refund_completed'] },
        },
      },
      { $group: { _id: null, totalRefundAmount: { $sum: '$amount' } } },
    ]);
    console.log('refunds agg ok', refunds);
  } catch (e) {
    console.error('refund agg failed:', e.message);
  }

  try {
    const topCategoriesData = await SubOrder.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'orderitems',
          localField: 'items',
          foreignField: '_id',
          as: 'itemDetails',
        },
      },
      { $unwind: '$itemDetails' },
      {
        $lookup: {
          from: 'products',
          localField: 'itemDetails.product',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      { $unwind: '$productDetails' },
      {
        $group: {
          _id: '$productDetails.category',
          earnings: { $sum: { $ifNull: ['$itemDetails.total', '$itemDetails.finalPrice'] } },
        },
      },
    ]);
    console.log('topCategories ok', topCategoriesData.length);
  } catch (e) {
    console.error('topCategories failed:', e.message, e.stack);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
