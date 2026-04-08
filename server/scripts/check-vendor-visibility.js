const mongoose = require('mongoose');
const User = require('../models/user');
const Order = require('../models/order.model');

(async()=>{
  await mongoose.connect('mongodb://root:password@mongo:27017/ecom-autoparts?authSource=admin');
  
  const users = await User.find({email: {$in: ['sarafroshan39@gmail.com', 'sarafroshan49@gmail.com']}});
  
  console.log('Found users:', users.length);
  users.forEach(u => {
    console.log('  - Email:', u.email, '| Role:', u.role, '| ID:', u._id);
  });
  
  if(users.length > 0) {
    const vendor1 = users[0];
    const vendorId = vendor1._id;
    console.log('\nChecking orders visible to', vendor1.email, '(ID:', vendorId, ')');
    
    // Simple query to find orders with this vendor
    const visibleOrders = await Order.find({
      $or: [
        { 'items.vendor': vendorId },
        { 'subOrders.vendor': vendorId }
      ]
    }).select('orderNumber');
    
    console.log('  Total orders visible to vendor:', visibleOrders.length);
    visibleOrders.slice(0, 5).forEach(o => console.log('    -', o.orderNumber));
    if(visibleOrders.length > 5) console.log('    ... and', visibleOrders.length - 5, 'more');
  }
  
  process.exit(0);
})();
