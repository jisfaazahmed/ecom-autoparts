const mongoose = require('mongoose');
const Order = require('../models/order.model');
const User = require('../models/user');

(async()=>{
  await mongoose.connect('mongodb://root:password@mongo:27017/ecom-autoparts?authSource=admin');
  
  const vendor = await User.findOne({email: 'sarafroshan39@gmail.com'});
  
  // Check the two user-reported orders
  const orders = await Order.find({
    orderNumber: {$in: ['ORD260408-00010', 'ORD260408-00012']}
  }).select('orderNumber items subOrders');
  
  console.log('✅ TASK 1 COMPLETE - Checking user-reported orders:');
  orders.forEach(o => {
    const hasVendor = o.subOrders.some(s => String(s.vendor) === String(vendor._id));
    console.log(`\n  Order: ${o.orderNumber}`);
    console.log(`  Items count: ${o.items.length}`);
    console.log(`  SubOrders count: ${o.subOrders.length}`);
    console.log(`  Vendor ${vendor.email} can see: ${hasVendor ? '✅ YES' : '❌ NO'}`);
  });
  
  process.exit(0);
})();
