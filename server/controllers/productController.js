const Product = require('../models/product');
const Vehicle = require('../models/vehicle');
const VehicleBrand = require('../models/vehicleBrand.model');
const VehicleModel = require('../models/vehicleModel.model');
const Review = require('../models/review.model');
const VendorProduct = require('../models/vendorProduct');
const mongoose = require('mongoose');
const NotificationService = require('../services/notification.service');
const User = require('../models/user');

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function emptyProductsPage(limit) {
  const limitNum = Math.max(1, parseInt(limit, 10) || 20);
  return {
    products: [],
    pagination: { page: 1, limit: limitNum, total: 0, totalPages: 0 },
  };
}

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

function mapCompatibleVehicleModels(models) {
  if (!Array.isArray(models)) return [];
  return models.map((m) => {
    if (m && typeof m === 'object' && m._id) {
      const mapped = {
        id: m._id.toString(),
        name: m.name,
      };
      if (m.brand && typeof m.brand === 'object' && m.brand._id) {
        mapped.brandId = m.brand._id.toString();
        mapped.brandName = m.brand.name;
      }
      return mapped;
    }
    return typeof m === 'object' ? String(m) : m;
  });
}

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
    compatibleVehicleModels: mapCompatibleVehicleModels(product.compatibleVehicleModels),
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

const normalizeSearchTerm = (value) => String(value || '').trim();

const buildSearchQuery = (searchTerm) => {
  const normalized = normalizeSearchTerm(searchTerm);
  if (!normalized) return null;

  // For short terms, use regex so partial prefixes still work.
  if (normalized.length < 3) {
    const safe = escapeRegex(normalized);
    return {
      query: {
        $or: [
          { name: { $regex: safe, $options: 'i' } },
          { description: { $regex: safe, $options: 'i' } },
          { sku: { $regex: safe, $options: 'i' } },
          { partNumber: { $regex: safe, $options: 'i' } },
        ],
      },
      sort: null,
    };
  }

  // Prefer text index for broader, faster matching.
  return {
    query: { $text: { $search: normalized } },
    sort: { score: { $meta: 'textScore' }, createdAt: -1 },
  };
};

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

async function resolveVehicleModelId(make, model) {
  if (!make || !model) return null;
  const brand = await VehicleBrand.findOne({
    name: { $regex: new RegExp(`^${escapeRegex(make)}$`, 'i') },
  });
  if (!brand) return null;

  const vModel = await VehicleModel.findOne({
    name: { $regex: new RegExp(`^${escapeRegex(model)}$`, 'i') },
    brand: brand._id,
  });
  return vModel ? vModel._id : null;
}

const resolveCompatibleVehicleIds = async (compatibleVariants) => {
  if (!Array.isArray(compatibleVariants)) return [];

  const normalizedIds = [...new Set(compatibleVariants.map((id) => String(id)))];
  if (normalizedIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw new Error('INVALID_COMPATIBLE_VARIANTS');
  }

  if (normalizedIds.length === 0) return [];

  const directVehicles = await Vehicle.find({ _id: { $in: normalizedIds } }).select('_id');
  if (directVehicles.length !== normalizedIds.length) {
    throw new Error('INVALID_COMPATIBLE_VARIANTS');
  }

  return directVehicles.map((vehicle) => String(vehicle._id));
};

async function resolveCompatibleVehicleModelIds(modelIds) {
  if (!Array.isArray(modelIds)) return [];

  const normalizedIds = [...new Set(modelIds.map((id) => String(id)))];
  if (normalizedIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    throw new Error('INVALID_COMPATIBLE_MODELS');
  }
  if (normalizedIds.length === 0) return [];

  const count = await VehicleModel.countDocuments({ _id: { $in: normalizedIds } });
  if (count !== normalizedIds.length) {
    throw new Error('INVALID_COMPATIBLE_MODELS');
  }

  return normalizedIds;
}

function applyProductPopulates(query) {
  return query
    .populate('category', 'name slug')
    .populate('createdBy', 'name shopName email status role shopWideDiscountPercent')
    .populate({
      path: 'compatibleVehicleModels',
      select: 'name brand',
      populate: { path: 'brand', select: 'name' },
    });
}

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
          sufficient: false,
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
          sufficient: false,
        });
        continue;
      }

      const available = product.stock || 0;
      results.push({
        productId: product._id,
        name: product.name,
        available,
        requested: item.quantity,
        sufficient: available >= item.quantity,
      });
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      sku,
      price,
      stock,
      categoryId,
      compatibleVariants,
      compatibleModels,
      compatibleVehicleModels,
      description,
      imageUrl,
      shopId,
      productDiscountPercent,
      partNumber,
    } = req.body;
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

    let vehicleIds = [];
    if (compatibleVariants !== undefined) {
      if (!Array.isArray(compatibleVariants)) {
        return res.status(400).json({ message: 'compatibleVariants must be an array' });
      }
      vehicleIds = await resolveCompatibleVehicleIds(compatibleVariants);
    }

    const modelIdsInput = compatibleModels || compatibleVehicleModels;
    let vehicleModelIds = [];
    if (modelIdsInput !== undefined) {
      if (!Array.isArray(modelIdsInput)) {
        return res.status(400).json({ message: 'compatibleModels must be an array' });
      }
      vehicleModelIds = await resolveCompatibleVehicleModelIds(modelIdsInput);
    }

    const finalStatus = requester.role === 'superadmin' ? 'Approved' : 'Pending';
    const ownerId = requester.role === 'superadmin' && shopId && mongoose.Types.ObjectId.isValid(String(shopId))
      ? String(shopId)
      : String(requester.id);

    const generatedSku = sku || `SKU-${Date.now()}`;
    const newProduct = new Product({
      name,
      sku: generatedSku,
      partNumber: partNumber || generatedSku,
      price: price || 0,
      stock: stock || 0,
      productDiscountPercent: toPercent(productDiscountPercent),
      image: imageUrl,
      category: categoryId || null,
      compatibleVehicles: vehicleIds,
      compatibleVehicleModels: vehicleModelIds,
      description,
      createdBy: ownerId,
      status: finalStatus,
    });

    await newProduct.save();

    const savedProduct = await applyProductPopulates(Product.findById(newProduct._id));

    if (requester.role === 'admin') {
      const vendor = await User.findById(requester.id);
      if (vendor) {
        NotificationService.notifySuperAdminProductAdded(savedProduct, vendor).catch((err) =>
          console.error('Error notifying super admin product added:', err)
        );
      }
    }

    res.status(201).json(mapProduct(savedProduct));
  } catch (err) {
    console.error(err);
    if (err?.message === 'INVALID_COMPATIBLE_VARIANTS') {
      return res.status(400).json({ message: 'One or more Vehicle Variant IDs are invalid.' });
    }
    if (err?.message === 'INVALID_COMPATIBLE_MODELS') {
      return res.status(400).json({ message: 'One or more Vehicle Model IDs are invalid.' });
    }
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

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
      compatibleModels,
      compatibleVehicleModels,
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

    const ownerId = product.createdBy?._id || product.createdBy?.id || product.createdBy;
    const isOwner = ownerId && String(ownerId) === String(requester.id);
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

    const modelIdsInput = compatibleModels !== undefined ? compatibleModels : compatibleVehicleModels;
    if (modelIdsInput !== undefined) {
      if (!Array.isArray(modelIdsInput)) {
        return res.status(400).json({ message: 'compatibleModels must be an array' });
      }
      product.compatibleVehicleModels = await resolveCompatibleVehicleModelIds(modelIdsInput);
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

    const updated = await applyProductPopulates(Product.findById(product._id));
    res.json(mapProduct(updated));
  } catch (err) {
    console.error(err);
    if (err?.message === 'INVALID_COMPATIBLE_VARIANTS') {
      return res.status(400).json({ message: 'One or more Vehicle Variant IDs are invalid.' });
    }
    if (err?.message === 'INVALID_COMPATIBLE_MODELS') {
      return res.status(400).json({ message: 'One or more Vehicle Model IDs are invalid.' });
    }
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};


// 1.06 DELETE PRODUCT (Admin or Super Admin)
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

    const isAdmin = requester.role === 'admin';
    const isSuperAdmin = requester.role === 'superadmin';
    if (!isAdmin && !isSuperAdmin) {
      return res.status(403).json({ message: 'Only admin or superadmin can delete products' });
    }

    await Promise.all([
      Review.deleteMany({ product: id }),
      VendorProduct.deleteMany({ product: id }),
      Product.findByIdAndDelete(id),
    ]);

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

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

    const product = await applyProductPopulates(
      Product.findByIdAndUpdate(id, { status }, { new: true })
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json(mapProduct(product));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

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

    const product = await applyProductPopulates(
      Product.findByIdAndUpdate(id, { featured }, { new: true })
    );

    if (!product) return res.status(404).json({ message: 'Product not found' });

    res.json(mapProduct(product));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const {
      vehicleId,
      categoryId,
      category,
      shop,
      status,
      isActive,
      search,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
      page = 1,
      limit = 20,
      make,
      model: vehicleModel,
    } = req.query;
    const requester = getRequester(req);
    const categoryFilter = categoryId || category;
    const query = {};

    if (shop) {
      query.createdBy = shop;

      const isSelfVendor = requester.role === 'admin' && String(requester.id || '') === String(shop);
      const isSuperAdmin = requester.role === 'superadmin';

      if (isSelfVendor || isSuperAdmin) {
        if (status) query.status = status;
      } else {
        query.status = 'Approved';
        query.isActive = true;
      }
    } else if (requester.role === 'superadmin') {
      if (status) query.status = status;
    } else {
      query.status = 'Approved';
      query.isActive = true;
    }

    if (categoryFilter) {
      query.category = categoryFilter;
    }

    if (vehicleId) {
      const vehicle = await Vehicle.findById(vehicleId).lean();
      if (!vehicle) {
        return res.json(emptyProductsPage(limit));
      }

      const modelId = await resolveVehicleModelId(vehicle.make, vehicle.model);
      if (modelId) {
        query.compatibleVehicleModels = modelId;
      } else {
        // No matching VehicleModel found for this vehicle, so no products can match
        return res.json(emptyProductsPage(limit));
      }
    }

    if (make && vehicleModel) {
      const modelId = await resolveVehicleModelId(make, vehicleModel);
      if (!modelId) {
        return res.json(emptyProductsPage(limit));
      }
      query.compatibleVehicleModels = modelId;
    }

    if (isActive !== undefined && query.isActive === undefined) {
      query.isActive = isActive === 'true';
    }

    const searchQuery = buildSearchQuery(search);
    if (searchQuery) {
      const searchClause = searchQuery.query;
      if (query.$or) {
        query.$and = [{ $or: query.$or }, searchClause];
        delete query.$or;
      } else {
        Object.assign(query, searchClause);
      }
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let sort = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    } else if (searchQuery?.sort) {
      sort = searchQuery.sort;
    } else {
      sort.createdAt = -1;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      applyProductPopulates(Product.find(query))
        .sort(sort)
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(query),
    ]);

    res.json({
      products: products.map(mapProduct),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

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
      const vehicle = await Vehicle.findById(vehicleId).lean();
      if (!vehicle) {
        return res.json([]);
      }

      const modelId = await resolveVehicleModelId(vehicle.make, vehicle.model);
      if (modelId) {
        query.compatibleVehicleModels = modelId;
      } else {
        return res.json([]);
      }
    }

    if (sellerFilter) {
      query.createdBy = sellerFilter;
    }

    const searchQuery = buildSearchQuery(search);
    if (searchQuery) {
      const searchClause = searchQuery.query;
      if (query.$or) {
        query.$and = [{ $or: query.$or }, searchClause];
        delete query.$or;
      } else {
        Object.assign(query, searchClause);
      }
    }

    const products = await applyProductPopulates(Product.find(query).sort(searchQuery?.sort || { createdAt: -1 }));
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
      {
        path: 'compatibleVehicleModels',
        select: 'name brand',
        populate: { path: 'brand', select: 'name' },
      },
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
      categories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Server error',
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

    const product = await applyProductPopulates(Product.findById(req.params.id));

    if (!product) {
      return res.status(404).json({
        message: 'Product not found',
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
      error: err.message,
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
    if (err && err.code === 11000) {
      return res.status(409).json({ message: 'You have already reviewed this product' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.updateProductReview = async (req, res) => {
  try {
    const productId = req.params.id;
    const { reviewId } = req.params;
    const userId = req.user?.id || req.user?._id || req.user?.userId;
    const { rating, comment } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(401).json({ message: 'Invalid user context' });
    }

    const parsedRating = Number(rating);
    if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ message: 'Rating must be a number between 1 and 5' });
    }

    const review = await Review.findOne({ _id: reviewId, product: productId });
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const requesterRole = normalizeRole(req.user?.role);
    const isOwner = String(review.user) === String(userId);
    const isAdmin = requesterRole === 'admin' || requesterRole === 'superadmin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to edit this review' });
    }

    review.rating = parsedRating;
    review.comment = typeof comment === 'string' && comment.trim() ? comment.trim() : undefined;
    await review.save();

    const hydrated = await Review.findById(review._id)
      .populate('user', 'name email role status shopName commissionRate createdAt');

    res.json(mapReview(hydrated));
  } catch (err) {
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
