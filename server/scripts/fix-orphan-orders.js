const mongoose = require('mongoose');
const Order = require('../models/order.model');
const OrderItem = require('../models/orderItem.model');
const User = require('../models/user');

(async () => {
  try {
    await mongoose.connect('mongodb://root:password@mongo:27017/ecom-autoparts?authSource=admin');
    
    const vendor1 = await User.findOne({ email: 'sarafroshan39@gmail.com' });
    
    console.log('Starting fix for orphan orders...');
    console.log('Assigning to Vendor ID:', vendor1._id);
    
    // Find all orphan orders (items with no vendor)
    const orphanOrders = await Order.find({ 'items.vendor': { $exists: false } });
    console.log('\nProcessing', orphanOrders.length, 'orphan orders');
    
    // Collect all orphan item IDs
    const orphanItemIds = [];
    for (const order of orphanOrders) {
      for (const itemId of order.items) {
        orphanItemIds.push(itemId);
      }
    }
    
    console.log('Total orphan items:', orphanItemIds.length);
    
    // Update all OrderItems to add vendor (including null ones)
    const updateResult = await OrderItem.updateMany(
      { _id: { $in: orphanItemIds }, $or: [ { vendor: { $exists: false } }, { vendor: null } ] },
      { $set: { vendor: vendor1._id } }
    );
    
    console.log('Updated OrderItem documents:', updateResult.modifiedCount);
    
    // Also update orders to rebuild subOrders
    let fixedOrderCount = 0;
    for (const order of orphanOrders) {
      const updated = await Order.findByIdAndUpdate(
        order._id,
        {
          $set: {
            updatedAt: new Date()
          }
        },
        { new: true }
      ).populate('items');
      
      // Rebuild subOrders from the now-populated items
      const subOrderMap = new Map();
      for (const item of updated.items || []) {
        const vendorId = item.vendor ? String(item.vendor) : null;
        if (!vendorId) continue;
        
        if (!subOrderMap.has(vendorId)) {
          subOrderMap.set(vendorId, []);
        }
        subOrderMap.get(vendorId).push(item._id);
      }
      
      updated.subOrders = Array.from(subOrderMap.entries()).map(([vendor, items]) => ({
        vendor: new mongoose.Types.ObjectId(vendor),
        items
      }));
      
      await updated.save();
      fixedOrderCount++;
      
      if (fixedOrderCount % 10 === 0) {
        console.log(`  Processed ${fixedOrderCount}/${orphanOrders.length}...`);
      }
    }
    
    console.log('\n✅ FIXED: ' + fixedOrderCount + ' orders');
    
    // Verify the fix
    const stillOrphan = await Order.find({ 'items.vendor': { $exists: false } });
    console.log('✅ Verification: ' + (stillOrphan.length === 0 ? 'All orphan orders fixed!' : 'WARNING: ' + stillOrphan.length + ' orders still orphaned'));
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
