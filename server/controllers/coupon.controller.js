const Coupon = require('../models/coupon.model');

function normalizeDiscountType(type) {
  const value = String(type || '').toLowerCase();
  if (value === 'fixedamount' || value === 'fixed_amount') return 'fixed_amount';
  if (value === 'fixed') return 'fixed';
  return 'percentage';
}

function mapCoupon(coupon) {
  const doc = coupon.toObject ? coupon.toObject() : coupon;
  return {
    id: String(doc._id),
    code: doc.code,
    description: doc.description || '',
    discountType: doc.discountType,
    discountValue: doc.discountValue,
    minimumOrderAmount: doc.minimumOrderAmount ?? 0,
    maxUses: doc.maxUses ?? null,
    usedCount: doc.usedCount ?? 0,
    validFrom: doc.validFrom,
    validUntil: doc.validUntil,
    isActive: !!doc.isActive,
    shopId: doc.shopId || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function computeDiscount(coupon, orderTotal) {
  const total = Number(orderTotal || 0);
  const value = Number(coupon.discountValue || 0);
  if (coupon.discountType === 'percentage') {
    const raw = (total * value) / 100;
    return Math.max(0, Math.min(total, Math.round(raw)));
  }

  return Math.max(0, Math.min(total, Math.round(value)));
}

exports.getCoupons = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const query = {};

    if (req.query.shopId) {
      query.shopId = req.query.shopId;
    }

    const [coupons, total] = await Promise.all([
      Coupon.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Coupon.countDocuments(query),
    ]);

    res.json({
      coupons: coupons.map(mapCoupon),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to fetch coupons' });
  }
};

exports.getCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json(mapCoupon(coupon));
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to fetch coupon' });
  }
};

exports.validateCoupon = async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const orderTotal = Number(req.body?.orderTotal || 0);
    const shopId = req.body?.shopId || null;

    if (!code) {
      return res.status(400).json({ valid: false, message: 'Coupon code is required' });
    }

    if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
      return res.status(400).json({ valid: false, message: 'Order total must be greater than zero' });
    }

    const coupon = await Coupon.findOne({ code, isActive: true });
    if (!coupon) {
      return res.json({ valid: false, message: 'Invalid coupon code' });
    }

    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) {
      return res.json({ valid: false, message: 'Coupon is not active yet' });
    }

    if (coupon.validUntil && now > coupon.validUntil) {
      return res.json({ valid: false, message: 'Coupon has expired' });
    }

    if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
      return res.json({ valid: false, message: 'Coupon usage limit reached' });
    }

    if (coupon.minimumOrderAmount && orderTotal < coupon.minimumOrderAmount) {
      return res.json({
        valid: false,
        message: `Minimum order amount is ${coupon.minimumOrderAmount}`,
      });
    }

    if (coupon.shopId && !shopId) {
      return res.json({ valid: false, message: 'Coupon is restricted to a specific shop' });
    }

    if (coupon.shopId && shopId && String(coupon.shopId) !== String(shopId)) {
      return res.json({ valid: false, message: 'Coupon is not valid for this shop' });
    }

    const discountAmount = computeDiscount(coupon, orderTotal);

    res.json({
      valid: true,
      coupon: mapCoupon(coupon),
      discountAmount,
    });
  } catch (error) {
    res.status(500).json({ valid: false, message: error.message || 'Failed to validate coupon' });
  }
};

exports.getPublicActiveCoupons = async (req, res) => {
  try {
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const now = new Date();

    const coupons = await Coupon.find({
      isActive: true,
      $or: [{ shopId: null }, { shopId: { $exists: false } }],
      validFrom: { $lte: now },
      $and: [
        {
          $or: [
            { validUntil: null },
            { validUntil: { $gte: now } },
          ],
        },
        {
          $or: [
            { maxUses: null },
            { $expr: { $lt: ['$usedCount', '$maxUses'] } },
          ],
        },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(limit);

    res.json({
      coupons: coupons.map(mapCoupon),
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to fetch active coupons' });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const payload = {
      code: String(req.body?.code || '').trim().toUpperCase(),
      description: req.body?.description || '',
      discountType: normalizeDiscountType(req.body?.discountType),
      discountValue: Number(req.body?.discountValue || 0),
      minimumOrderAmount: Number(req.body?.minimumOrderAmount || 0),
      maxUses: req.body?.maxUses ? Number(req.body.maxUses) : null,
      validFrom: req.body?.validFrom ? new Date(req.body.validFrom) : new Date(),
      validUntil: req.body?.validUntil ? new Date(req.body.validUntil) : null,
      isActive: req.body?.isActive !== false,
      shopId: req.body?.shopId || null,
    };

    if (!payload.code) {
      return res.status(400).json({ message: 'Coupon code is required' });
    }

    if (!Number.isFinite(payload.discountValue) || payload.discountValue <= 0) {
      return res.status(400).json({ message: 'Discount value must be greater than zero' });
    }

    if (payload.discountType === 'percentage' && payload.discountValue > 100) {
      return res.status(400).json({ message: 'Percentage discount cannot exceed 100' });
    }

    const coupon = await Coupon.create(payload);
    res.status(201).json(mapCoupon(coupon));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Coupon code already exists' });
    }
    res.status(500).json({ message: error.message || 'Failed to create coupon' });
  }
};

exports.updateCoupon = async (req, res) => {
  try {
    const updates = { ...req.body };

    if (updates.code !== undefined) {
      updates.code = String(updates.code || '').trim().toUpperCase();
    }
    if (updates.discountType !== undefined) {
      updates.discountType = normalizeDiscountType(updates.discountType);
    }
    if (updates.discountValue !== undefined) {
      updates.discountValue = Number(updates.discountValue);
    }
    if (updates.minimumOrderAmount !== undefined) {
      updates.minimumOrderAmount = Number(updates.minimumOrderAmount || 0);
    }
    if (updates.maxUses !== undefined) {
      updates.maxUses = updates.maxUses ? Number(updates.maxUses) : null;
    }
    if (updates.validFrom !== undefined) {
      updates.validFrom = updates.validFrom ? new Date(updates.validFrom) : new Date();
    }
    if (updates.validUntil !== undefined) {
      updates.validUntil = updates.validUntil ? new Date(updates.validUntil) : null;
    }

    if (updates.discountType === 'percentage' && Number(updates.discountValue) > 100) {
      return res.status(400).json({ message: 'Percentage discount cannot exceed 100' });
    }

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json(mapCoupon(coupon));
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'Coupon code already exists' });
    }
    res.status(500).json({ message: error.message || 'Failed to update coupon' });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message || 'Failed to delete coupon' });
  }
};
