const VendorProduct = require('../models/vendorProduct');

// 1. ADD OFFER (Vendor Only)
// Vendor says: "I have this item."
exports.addOffer = async (req, res) => {
  try {
    const { productId, price, stock, condition } = req.body;

    // Check if offer already exists for this vendor
    const existingOffer = await VendorProduct.findOne({ 
      product: productId, 
      vendor: req.user.id 
    });

    if (existingOffer) {
      return res.status(400).json({ message: 'You already listed this product. Update your existing offer instead.' });
    }

    const newOffer = new VendorProduct({
      product: productId,
      vendor: req.user.id, // Grab ID from the Token
      price,
      stock,
      condition
    });

    await newOffer.save();
    res.status(201).json({ message: 'Offer added successfully', offer: newOffer });

  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

// 2. GET OFFERS FOR A PRODUCT (Public)
// Customer sees: "Sold by Bob for $50, Sold by Alice for $45"
exports.getOffers = async (req, res) => {
  try {
    const { productId } = req.params;

    const offers = await VendorProduct.find({ product: productId, isActive: true })
      .populate('vendor', 'shopName') // Show the Shop Name (e.g., "Bob's Brakes")
      .sort({ price: 1 }); // Show cheapest price first

    res.json(offers);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};