const mongoose = require('mongoose');
const Product = require('../models/product');
const VendorProduct = require('../models/vendorProduct');
const User = require('../models/user');

(async()=>{
  try {
    await mongoose.connect('mongodb://root:password@mongo:27017/ecom-autoparts?authSource=admin');
    
    const vendor = await User.findOne({email: 'sarafroshan39@gmail.com'});
    
    console.log('Starting Product-Level Ownership Audit...');
    console.log('Using vendor:', vendor.email, '(' + vendor._id + ')\n');
    
    // Get all products
    const allProducts = await Product.find({}).select('_id name');
    console.log('Total products in catalog:', allProducts.length);
    
    // Find products without VendorProduct offers
    const productsWithOffers = await VendorProduct.find({}).distinct('product');
    const productsWithoutOffers = allProducts.filter(p => 
      !productsWithOffers.includes(p._id)
    );
    
    console.log('Products with vendor offers:', productsWithOffers.length);
    console.log('Products WITHOUT vendor offers:', productsWithoutOffers.length);
    
    if(productsWithoutOffers.length > 0) {
      console.log('\nProducts needing vendor offers:');
      productsWithoutOffers.slice(0, 10).forEach(p => {
        console.log('  - ' + p.name + ' (ID: ' + p._id + ')');
      });
      if(productsWithoutOffers.length > 10) {
        console.log('  ... and', productsWithoutOffers.length - 10, 'more');
      }
    }
    
    process.exit(0);
  } catch(err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
