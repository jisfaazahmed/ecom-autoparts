const mongoose = require('mongoose');
const OrderItem = require('../models/orderItem.model');

(async () => {
  try {
    await mongoose.connect('mongodb://root:password@mongo:27017/ecom-autoparts?authSource=admin');
    
    // Get a single OrderItem to check
    const item = await OrderItem.findById('69d68d60b68237a99eb40a8e');
    
    console.log('OrderItem Details:');
    console.log('  ID:', item._id);
    console.log('  Vendor:', item.vendor);
    console.log('  Vendor type:', typeof item.vendor);
    console.log('  Vendor exists:', item.vendor !== undefined && item.vendor !== null);
    
    // Check how many OrderItems have vendor
    const withVendor = await OrderItem.countDocuments({ vendor: { $exists: true, $ne: null } });
    const withoutVendor = await OrderItem.countDocuments({ vendor: { $exists: false } });
    const withNull = await OrderItem.countDocuments({ vendor: null });
    
    console.log('\nOrderItem counts:');
    console.log(`  With vendor field: ${withVendor}`);
    console.log(`  Without vendor field: ${withoutVendor}`);
    console.log(`  With null vendor: ${withNull}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
