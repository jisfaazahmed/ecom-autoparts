const Wishlist = require('../models/wishlist.model');

// GET /api/wishlist - full populated wishlist
exports.getWishlist = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const wishlist = await Wishlist.findOne({ user: userId }).populate(
      'products',
      'name price image sku stock isActive status category createdBy'
    );
    return res.json({ products: wishlist?.products || [] });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/wishlist/ids - only product IDs (cheap, used for heart icon state)
exports.getWishlistIds = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const wishlist = await Wishlist.findOne({ user: userId }, 'products');
    const productIds = (wishlist?.products || []).map((id) => String(id));
    return res.json({ productIds });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/wishlist/:productId - add product
exports.addToWishlist = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { productId } = req.params;
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { $addToSet: { products: productId } },
      { new: true, upsert: true }
    );
    const productIds = wishlist.products.map((id) => String(id));
    return res.json({ message: 'Added to wishlist', productIds });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// DELETE /api/wishlist/:productId - remove product
exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { productId } = req.params;
    const wishlist = await Wishlist.findOneAndUpdate(
      { user: userId },
      { $pull: { products: productId } },
      { new: true }
    );
    const productIds = (wishlist?.products || []).map((id) => String(id));
    return res.json({ message: 'Removed from wishlist', productIds });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
