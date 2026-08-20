require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const config = require('../config/config');

require('../models/user');
require('../models/order.model');
require('../models/orderItem.model');
require('../models/payment.model');
require('../models/refund.model');
require('../models/product');

const refundService = require('../services/refund.service');

async function main() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
  await mongoose.connect(uri);

  try {
    const result = await refundService.getAdminRefunds({ limit: 5 });
    console.log('OK', result.pagination, 'refunds', result.refunds.length);
  } catch (e) {
    console.error('FAIL', e.message);
    console.error(e.stack);
  }

  await mongoose.disconnect();
}

main();
