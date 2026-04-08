const mongoose = require('mongoose');
const Product = require('../models/product');
const VendorProduct = require('../models/vendorProduct');
const User = require('../models/user');

(async()=>{
  try {
    await mongoose.connect('mongodb://root:password@mongo:27017/ecom-autoparts?authSource=admin');
    
    const vendor = await User.findOne({email: 'sarafroshan39@gmail.com'});
    
    console.log('Creating VendorProduct offers...');
    console.log('Vendor:', vendor.email, '(' + vendor._id + ')\n');
    
    // Get all products that don't have offers
    const productsWithOffers = await VendorProduct.find({}).distinct('product');
    const productsNeedingOffers = await Product.find({
      _id: { $nin: productsWithOffers }
    }).select('_id name price');
    
    console.log('Creating offers for', productsNeedingOffers.length, 'products...\n');
    
    const offers = [];
    for(const product of productsNeedingOffers) {
      offers.push({
        product: product._id,
        vendor: vendor._id,
        price: product.price || 0,
        stock: 100,  // Default reasonable stock
        condition: 'New',
        isActive: true
      });
    }
    
    // Batch insert
    const created = await VendorProduct.insertMany(offers, { ordered: false });
    
    console.log('✅ Created', created.length, 'VendorProduct offers');
    
    // Verify
    const totalOffers = await VendorProduct.countDocuments({vendor: vendor._id});
    console.log('Total offers for this vendor:', totalOffers);
    
    process.exit(0);
  } catch(err) {
    console.error('Error:', err.message);
    if(err.name === 'MongoBulkWriteError') {
      console.log('Partial insert - already has', err.result?.insertedCount, 'records');
    }
    process.exit(1);
  }
})();
