const Product = require('../models/product');
const Vehicle = require('../models/vehicle');
const VehicleVariant = require('../models/vehicleVariant.model');
const Review = require('../models/review.model');
const VendorProduct = require('../models/vendorProduct');
const mongoose = require('mongoose');
const NotificationService = require('../services/notification.service');
const User = require('../models/user');


const normalizeRole = (role) => {
  const normalized = String(role || '').toLowerCase().replace('_', '');
  if (normalized === 'superadmin') return 'superadmin';
  if (normalized === 'admin') return 'admin';
  return 'customer';
};

const toPercent = (value) => {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 90) return 90;
  return n;
};

const applyDiscount = (price, percent) => {
  const base = Number(price || 0);
  const pct = toPercent(percent);
  const discounted = base - (base * pct) / 100;
  return Number(discounted.toFixed(2));
};

const mapProduct = (productDoc) => {
  const product = productDoc?.toJSON ? productDoc.toJSON() : productDoc;
  if (!product) return null;

  const categoryObj = product.category && typeof product.category === 'object' ? product.category : null;
  const sellerObj = product.createdBy && typeof product.createdBy === 'object' ? product.createdBy : null;
  const compatibleVehicles = Array.isArray(product.compatibleVehicles) ? product.compatibleVehicles : [];
  const productDiscountPercent = toPercent(product.productDiscountPercent);
  const shopDiscountPercent = toPercent(sellerObj?.shopWideDiscountPercent);
  const effectiveDiscountPercent = Math.max(productDiscountPercent, shopDiscountPercent);
  const originalPrice = Number(product.price || 0);
  const discountedPrice = applyDiscount(originalPrice, effectiveDiscountPercent);

  const categoryId = categoryObj
    ? String(categoryObj._id || categoryObj.id || '')
    : (product.category ? String(product.category) : '');

  const shopId = sellerObj
    ? String(sellerObj._id || sellerObj.id || '')
    : (product.createdBy ? String(product.createdBy) : '');

  return {
    ...product,
    id: String(product._id || product.id || ''),
    imageUrl: product.imageUrl || product.image || '',
    image_url: product.image_url || product.image || '',
    categoryId,
    originalPrice,
    price: discountedPrice,
    productDiscountPercent,
    shopDiscountPercent,
    effectiveDiscountPercent,
    hasDiscount: effectiveDiscountPercent > 0,
    compatibleVariants: compatibleVehicles.map((vehicle) => String(vehicle?._id || vehicle?.id || vehicle || '')),
    featured: !!product.featured,
    shopId,
    shop: sellerObj
      ? {
          id: shopId,
          name: sellerObj.shopName || sellerObj.name || 'Unknown Shop',
          ownerId: shopId,
          status: String(sellerObj.status || '').toLowerCase(),
          email: sellerObj.email || undefined,
        }
      : undefined,
  };
};

const getRequester = (req) => ({
  role: normalizeRole(req?.user?.role),
  id: req?.user?.id || req?.user?._id || req?.user?.userId || null,
});

const mapReview = (reviewDoc) => {
  const review = reviewDoc.toJSON ? reviewDoc.toJSON() : reviewDoc.toObject();
  const populatedUser = review.user && typeof review.user === 'object' ? review.user : null;
  const productId = review.product && typeof review.product === 'object' ? review.product._id : review.product;

  return {
    id: String(review._id),
    productId: String(productId || ''),
    userId: String(populatedUser?._id || review.user || ''),
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    user: populatedUser
      ? {
          id: String(populatedUser._id || ''),
          email: populatedUser.email || '',
          fullName: populatedUser.name || 'Anonymous',
          role: normalizeRole(populatedUser.role),
          status: populatedUser.status,
          shopName: populatedUser.shopName,
          commissionRate: populatedUser.commissionRate,
          createdAt: populatedUser.createdAt,
        }
      : undefined,
  };
};

const resolveCompatibleVehicleIds = async (compatibleVariants) => {
  if (!Array.isArray(compatibleVariants)) return [];

  const normalizedIds = [...new Set(compatibleVariants.map((id) => String(id)))];
  if (normalizedIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw new Error('INVALID_COMPATIBLE_VARIANTS');
  }

  if (normalizedIds.length === 0) return [];

  const directVehicles = await Vehicle.find({ _id: { $in: normalizedIds } }).select('_id');
  const directVehicleIdSet = new Set(directVehicles.map((v) => String(v._id)));
  const unresolvedVariantIds = normalizedIds.filter((id) => !directVehicleIdSet.has(id));

  if (unresolvedVariantIds.length === 0) {
    return [...directVehicleIdSet];
  }

  const variants = await VehicleVariant.find({ _id: { $in: unresolvedVariantIds } })
    .populate({
      path: 'model',
      select: 'name brand',
      populate: { path: 'brand', select: 'name' },
    });

  if (variants.length !== unresolvedVariantIds.length) {
    throw new Error('INVALID_COMPATIBLE_VARIANTS');
  }

  const mappedVehicleIds = new Set([...directVehicleIdSet]);
  const currentYear = new Date().getFullYear();

  for (const variant of variants) {
    const modelDoc = variant.model;
    const brandDoc = modelDoc?.brand;
    const makeName = brandDoc?.name;
    const modelName = modelDoc?.name;

    if (!makeName || !modelName) {
      throw new Error('INVALID_COMPATIBLE_VARIANTS');
    }

    const yearEnd = variant.yearEnd || currentYear;
    const matchedVehicles = await Vehicle.find({
      make: makeName,
      model: modelName,
      submodel: variant.name,
      year: { $gte: variant.yearStart, $lte: yearEnd },
    }).select('_id');

    if (!matchedVehicles.length) {
      throw new Error('INVALID_COMPATIBLE_VARIANTS');
    }

    matchedVehicles.forEach((vehicle) => mappedVehicleIds.add(String(vehicle._id)));
  }

  return [...mappedVehicleIds];
};

exports.checkStock = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: 'Invalid items array' });
    }

    const results = [];
    for (const item of items) {
      if (!mongoose.Types.ObjectId.isValid(item.productId)) {
        results.push({
          productId: item.productId,
          name: 'Unknown Product',
          available: 0,
          requested: item.quantity,
          sufficient: false
        });
        continue;
      }
      
      const product = await Product.findById(item.productId);
      if (!product) {
        results.push({
          productId: item.productId,
          name: 'Unknown Product',
          available: 0,
          requested: item.quantity,
          sufficient: false
        });
        continue;
      }
      
      const available = product.stock || 0;
      results.push({
        productId: product._id,
        name: product.name,
        available: available,
        requested: item.quantity,
        sufficient: available >= item.quantity
      });
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

// 1. CREATE PRODUCT (Sellers & Admins)
exports.createProduct = async (req, res) => {
  try {
    const { name, sku, price, stock, categoryId, compatibleVariants, description, imageUrl, shopId, productDiscountPercent } = req.body;
    const requester = getRequester(req);

    if (!['admin', 'superadmin'].includes(requester.role)) {
      return res.status(403).json({ message: 'Only sellers/admins can create products' });
    }

    if (!requester.id || !mongoose.Types.ObjectId.isValid(String(requester.id))) {
      return res.status(401).json({ message: 'Invalid user context' });
    }

    if (!name || !categoryId) {
      return res.status(400).json({ message: 'Product name and category are required' });
    }

    // Map compatibleVariants (variant IDs or vehicle IDs) to vehicle IDs.
    let vehicleIds = [];
    if (compatibleVariants !== undefined) {
      if (!Array.isArray(compatibleVariants)) {
        return res.status(400).json({ message: 'compatibleVariants must be an array' });
      }
      vehicleIds = await resolveCompatibleVehicleIds(compatibleVariants);
    }

    // Default status to 'Pending' for sellers. Super Admin could theoretially approve immediately, 
    // but let's keep all new creations as 'Pending' or let admin pass 'Approved'
    const finalStatus = requester.role === 'superadmin' ? 'Approved' : 'Pending';

    // Sellers must not be able to spoof ownership by posting a different shopId.
    const ownerId = requester.role === 'superadmin' && shopId && mongoose.Types.ObjectId.isValid(String(shopId))
      ? String(shopId)
      : String(requester.id);

    // Create the product
    const newProduct = new Product({
      name,
      sku: sku || 'SKU-' + Date.now(),
      price: price || 0,
      stock: stock || 0,
      productDiscountPercent: toPercent(productDiscountPercent),
      image: imageUrl,
      category: categoryId || null,
      compatibleVehicles: vehicleIds,
      description,
      createdBy: ownerId,
      status: finalStatus
    });

    await newProduct.save();

    const savedProduct = await Product.findById(newProduct._id)
      .populate('category', 'name')
      .populate('createdBy', 'name shopName email status role shopWideDiscountPercent');

    // Notify Super Admin if created by a vendor (role ADMIN)
    if (requester.role === 'admin') {
      const vendor = await User.findById(requester.id);
      if (vendor) {
        NotificationService.notifySuperAdminProductAdded(savedProduct, vendor).catch(err => console.error('Error notifying super admin product added:', err));
      }
    }


    res.status(201).json(mapProduct(savedProduct));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// 1.05 UPDATE PRODUCT (Owner seller or Super Admin)
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const requester = getRequester(req);
    const {
      name,
      sku,
      price,
      stock,
      categoryId,
      compatibleVariants,
      description,
      imageUrl,
      isActive,
      productDiscountPercent,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    if (!requester.id || !mongoose.Types.ObjectId.isValid(String(requester.id))) {
      return res.status(401).json({ message: 'Invalid user context' });
    }

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const ownerId = String(product.createdBy || '');
    const isOwner = ownerId && ownerId === String(requester.id);
    const isSuperAdmin = requester.role === 'superadmin';
    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({ message: 'Not authorized to update this product' });
    }

    if (compatibleVariants !== undefined) {
      if (!Array.isArray(compatibleVariants)) {
        return res.status(400).json({ message: 'compatibleVariants must be an array' });
      }
      product.compatibleVehicles = await resolveCompatibleVehicleIds(compatibleVariants);
    }

    if (name !== undefined) product.name = name;
    if (sku !== undefined) product.sku = sku;
    if (price !== undefined) product.price = price;
    if (stock !== undefined) product.stock = stock;
    if (description !== undefined) product.description = description;
    if (imageUrl !== undefined) product.image = imageUrl;
    if (categoryId !== undefined) product.category = categoryId;
    if (isActive !== undefined) product.isActive = !!isActive;
    if (productDiscountPercent !== undefined) {
      const discount = Number(productDiscountPercent);
      if (!Number.isFinite(discount) || discount < 0 || discount > 90) {
        return res.status(400).json({ message: 'productDiscountPercent must be between 0 and 90' });
      }
      product.productDiscountPercent = discount;
    }

    await product.save();

    const updated = await Product.findById(product._id)
      .populate('category', 'name')
      .populate('createdBy', 'name shopName email status role shopWideDiscountPercent')
      .populate('compatibleVehicles', 'year make model');

    res.json(mapProduct(updated));
  } catch (err) {
    console.error(err);
    if (err?.message === 'INVALID_COMPATIBLE_VARIANTS') {
      return res.status(400).json({ message: 'One or more Vehicle Variant IDs are invalid.' });
    }
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// 1.06 DELETE PRODUCT (Owner seller or Super Admin)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const requester = getRequester(req);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    if (!requester.id || !mongoose.Types.ObjectId.isValid(String(requester.id))) {
      return res.status(401).json({ message: 'Invalid user context' });
    }

    const product = await Product.findById(id).select('createdBy');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const ownerId = String(product.createdBy || '');
    const isOwner = ownerId && ownerId === String(requester.id);
    const isSuperAdmin = requester.role === 'superadmin';
    if (!isOwner && !isSuperAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this product' });
    }

    await Promise.all([
      Review.deleteMany({ product: id }),
      VendorProduct.deleteMany({ product: id }),
      Product.findByIdAndDelete(id),
    ]);

    res.status(204).send();
  } catch (err) {
    console.error(err);
    if (err?.message === 'INVALID_COMPATIBLE_VARIANTS') {
      return res.status(400).json({ message: 'One or more Vehicle Variant IDs are invalid.' });
    }
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// 1.1 UPDATE PRODUCT STATUS (Super Admin Only)
exports.updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    
    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const product = await Product.findByIdAndUpdate(id, { status }, { new: true })
      .populate('category', 'name')
      .populate('createdBy', 'name shopName email status role shopWideDiscountPercent')
      .populate('compatibleVehicles', 'year make model');
    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json(mapProduct(product));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// 1.2 UPDATE FEATURED FLAG (Super Admin Only)
exports.updateProductFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    const { featured } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }
    if (typeof featured !== 'boolean') {
      return res.status(400).json({ message: 'featured must be a boolean' });
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { featured },
      { new: true }
    )
      .populate('category', 'name')
      .populate('createdBy', 'name shopName email status role shopWideDiscountPercent')
      .populate('compatibleVehicles', 'year make model submodel');

    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json(mapProduct(product));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// 2. SEARCH PRODUCTS (The "Tesla > Model S > Brakes" Logic)
exports.getProducts = async (req, res) => {
  try {
    const { vehicleId, categoryId, category, shop, status } = req.query;
    const requester = getRequester(req);
    const categoryFilter = categoryId || category;
    
    const query = {};

    // 1. If searching by a specific shop/seller (Vendor Dashboard)
    if (shop) {
      query.createdBy = shop;

      const isSelfVendor = requester.role === 'admin' && String(requester.id || '') === String(shop);
      const isSuperAdmin = requester.role === 'superadmin';

      if (isSelfVendor || isSuperAdmin) {
        // Vendor owner and super admin can inspect all statuses when needed.
        if (status) query.status = status;
      } else {
        // Public/customer should only see approved and active products.
        query.status = 'Approved';
        query.isActive = true;
      }
    } else {
      // 2. Or, public facing search: ONLY SHOW APPROVED
      if (requester.role === 'superadmin') {
        // Super Admins can see specific status or ALL if no status provided
        if (status) query.status = status;
      } else {
        // Public sees only approved
        query.status = 'Approved';
        query.isActive = true;
      }
    }

    // Filter by Category (e.g., "Brake Pads")
    if (categoryFilter) {
      query.category = categoryFilter;
    }

    // Filter by Vehicle (e.g., "Tesla Model S")
    if (vehicleId) {
      // Find products where the 'compatibleVehicles' array CONTAINS this vehicleId
      query.compatibleVehicles = vehicleId;
    }

    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('createdBy', 'name shopName email status role shopWideDiscountPercent')
      .populate('compatibleVehicles', 'year make model'); // Show car names in result

    res.json(products.map(mapProduct));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

// 2.1 SUPER ADMIN PRODUCT LIST (strictly authenticated)
exports.getSuperAdminProducts = async (req, res) => {
  try {
    const { vehicleId, categoryId, category, status, search, shop, shopId } = req.query;
    const query = {};
    const categoryFilter = categoryId || category;
    const sellerFilter = shop || shopId;

    if (status) {
      query.status = status;
    }

    if (categoryFilter) {
      query.category = categoryFilter;
    }

    if (vehicleId) {
      query.compatibleVehicles = vehicleId;
    }

    if (sellerFilter) {
      query.createdBy = sellerFilter;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }

    const products = await Product.find(query)
      .populate('category', 'name')
      .populate('createdBy', 'name shopName email status role shopWideDiscountPercent')
      .populate('compatibleVehicles', 'year make model');

    res.json(products.map(mapProduct));
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

exports.getFeaturedProducts = async (req, res) => {
  try {
    const products = await Product.find({
      featured: true,
      isActive: true,
      status: 'Approved',
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(8);
    
    const hydrated = await Product.populate(products, [
      { path: 'category', select: 'name' },
      { path: 'createdBy', select: 'name shopName email status role shopWideDiscountPercent' },
      { path: 'compatibleVehicles', select: 'year make model submodel' },
    ]);

    res.json(hydrated.map(mapProduct));
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Server error',
      error: err.message,
    });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await Product.distinct('category', { isActive: true });
    
    res.json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      success: false,
      message: 'Server error' 
    });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const requester = getRequester(req);
    const requesterId = requester.id ? String(requester.id) : '';

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findById(req.params.id)
      .populate('category', 'name')
      .populate('createdBy', 'name shopName email status role shopWideDiscountPercent')
      .populate('compatibleVehicles', 'year make model');
    
    if (!product) {
      return res.status(404).json({ 
        message: 'Product not found' 
      });
    }

    const ownerId = String(product.createdBy?._id || product.createdBy || '');
    const isOwner = requester.role === 'admin' && ownerId && requesterId === ownerId;
    const canViewHidden = requester.role === 'superadmin' || isOwner;
    if ((!product.isActive || product.status !== 'Approved') && !canViewHidden) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(mapProduct(product));
  } catch (err) {
    console.error(err);
    res.status(500).json({ 
      message: 'Server error',
      error: err.message 
    });
  }
}; 

exports.getProductReviews = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const reviews = await Review.find({ product: productId })
      .populate('user', 'name email role status shopName commissionRate createdAt')
      .sort({ createdAt: -1 });

    res.json(reviews.map(mapReview));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.createProductReview = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.user?.id || req.user?._id || req.user?.userId;
    const { rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Invalid user context' });
    }

    const parsedRating = Number(rating);
    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ message: 'Rating must be a number between 1 and 5' });
    }

    const product = await Product.findById(productId).select('_id');
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const payload = {
      rating: parsedRating,
      comment: typeof comment === 'string' && comment.trim() ? comment.trim() : undefined,
    };

    const existingReview = await Review.findOne({ product: productId, user: userId });

    let savedReview;
    let statusCode;

    if (existingReview) {
      existingReview.rating = payload.rating;
      existingReview.comment = payload.comment;
      savedReview = await existingReview.save();
      statusCode = 200;
    } else {
      savedReview = await Review.create({
        product: productId,
        user: userId,
        rating: payload.rating,
        comment: payload.comment,
      });
      statusCode = 201;
    }

    const hydrated = await Review.findById(savedReview._id)
      .populate('user', 'name email role status shopName commissionRate createdAt');

    res.status(statusCode).json(mapReview(hydrated));
  } catch (err) {
    // Duplicate key can happen if race condition creates same product/user review concurrently.
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'You have already reviewed this product' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.deleteProductReview = async (req, res) => {
  try {
    const productId = req.params.id;
    const { reviewId } = req.params;
    const userId = req.user?.id || req.user?._id || req.user?.userId;
    const requesterRole = normalizeRole(req.user?.role);

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Invalid user context' });
    }

    const review = await Review.findOne({ _id: reviewId, product: productId });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const isOwner = String(review.user) === String(userId);
    const isAdmin = requesterRole === 'admin' || requesterRole === 'superadmin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }

    await review.deleteOne();
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
