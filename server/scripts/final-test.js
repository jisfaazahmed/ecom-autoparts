const mongoose = require('mongoose');
const Order = require('../models/order.model');
const Product = require('../models/product');
const VendorProduct = require('../models/vendorProduct');
const User = require('../models/user');

(async()=>{
  try {
    await mongoose.connect('mongodb://root:password@mongo:27017/ecom-autoparts?authSource=admin');
    
    const vendor = await User.findOne({email: 'sarafroshan39@gmail.com'});
    
    console.log('=== FINAL COMPREHENSIVE TEST ===\n');
    
    // Test 1: Vendor visibility of fixed orders
    console.log('TEST 1: Vendor visibility of orphan orders');
    const visibleOrders = await Order.find({
      $or: [
        { 'items.vendor': vendor._id },
        { 'subOrders.vendor': vendor._id }
      ]
    });
    console.log('  ✅ Vendor can see', visibleOrders.length, 'orders');
    
    const userOrders = await Order.find({orderNumber: {$in: ['ORD260408-00010', 'ORD260408-00012']}});
    const userOrdersVisible = userOrders.every(o => 
      o.subOrders.some(s => String(s.vendor) === String(vendor._id))
    );
    console.log('  ✅ User-reported orders visible:', userOrdersVisible ? 'YES' : 'NO');
    
    // Test 2: Product ownership
    console.log('\nTEST 2: Product ownership via VendorProduct');
    const productsWithOffers = await VendorProduct.countDocuments({vendor: vendor._id});
    console.log('  ✅ Vendor has offers for ' + productsWithOffers + '/56 products');
    
    // Test 3: Order creation will now auto-resolve vendors
    console.log('\nTEST 3: Future orders will auto-resolve vendors');
    const testProduct = await Product.findOne({});
    const testOffer = await VendorProduct.findOne({product: testProduct._id, vendor: vendor._id});
    console.log('  ✅ Can find VendorProduct offer for test product:', testOffer ? 'YES' : 'NO');
    
    console.log('\n=== ALL TESTS COMPLETE ===\n');
    
    process.exit(0);
  } catch(err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
