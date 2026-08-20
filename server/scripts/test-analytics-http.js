require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const config = require('../config/config');

// Load models like the running server
require('../models/user');
require('../models/order.model');
require('../models/orderItem.model');
require('../models/subOrder.model');
require('../models/refund.model');

const adminAnalyticsController = require('../controllers/adminAnalyticsController');

async function main() {
  const { MONGO_IP, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_DB } = config;
  const uri = `mongodb://${MONGO_USER}:${MONGO_PASSWORD}@${MONGO_IP}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
  await mongoose.connect(uri);

  const user = await mongoose.model('User').findOne({ role: 'SUPER_ADMIN' });
  if (!user) {
    console.error('No super admin in DB');
    process.exit(1);
  }

  const req = { query: { range: '1y' }, user: { id: user.id, role: 'SUPER_ADMIN' } };
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      console.log('STATUS', this.statusCode);
      console.log(JSON.stringify(payload, null, 2).slice(0, 800));
    },
  };

  await adminAnalyticsController.getSuperAdminAnalytics(req, res);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
