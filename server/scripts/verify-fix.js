const mongoose = require('mongoose');
const Order = require('../models/order.model');

(async () => {
  try {
    await mongoose.connect('mongodb://root:password@mongo:27017/ecom-autoparts?authSource=admin');
    
    // Get an order we just fixed
    const order = await Order.findOne({ orderNumber: 'ORD260408-00010' });
    
    console.log('Order Number:', order?.orderNumber);
    console.log('Order items:', order?.items?.length || 0);
    
    if (order?.items?.length > 0) {
      console.log('\nFirst item details:');
      const item = order.items[0];
      console.log('  Item ID:', item._id);
      console.log('  Vendor:', item.vendor);
      console.log('  Vendor type:', typeof item.vendor);
      console.log('  Vendor exists:', item.vendor !== undefined && item.vendor !== null);
      console.log('  Full item:', JSON.stringify(item, null, 2));
    }
    
    console.log('\nSubOrders:', order?.subOrders?.length || 0);
    if (order?.subOrders?.length > 0) {
      console.log('SubOrder 0:', JSON.stringify(order.subOrders[0], null, 2));
    }
    
    // Try the query
    const orphanCheck = await Order.find({ 'items.vendor': { $exists: false } }).limit(1);
    console.log('\nOrphan query result count:', orphanCheck.length);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
