const User = require('../models/user');

// Map backend status to client-friendly lowercase
const STATUS_TO_CLIENT = {
  ACTIVE: 'approved',
  PENDING: 'pending',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
};

// Map client status to backend enum
const CLIENT_TO_STATUS = {
  approved: 'ACTIVE',
  active: 'ACTIVE',
  pending: 'PENDING',
  rejected: 'REJECTED',
  suspended: 'SUSPENDED',
};

/**
 * Convert User (ADMIN/vendor) to ApiShop shape for client
 * Ensures consistent data structure across all endpoints
 */
function userToShop(user) {
  if (!user) return null;
  const u = user.toObject ? user.toObject() : user;
  return {
    id: u._id.toString(),
    name: u.shopName || u.name || '',
    description: u.shopDescription || null,
    logoUrl: u.logoUrl || null,
    ownerId: u._id.toString(),
    status: STATUS_TO_CLIENT[u.status] || u.status?.toLowerCase() || 'pending',
    email: u.email || null,
    phone: u.phone || null,
    address: u.address || null,
    businessRegistration: u.businessRegistration || null,
    commissionRate: u.commissionRate != null ? u.commissionRate : 10,
    rejectionReason: u.rejectionReason || null,
    bankDetails: u.bankDetails && (u.bankDetails.accountNumber || u.bankDetails.accountHolderName)
      ? {
        accountHolderName: u.bankDetails.accountHolderName || '',
        accountNumber: u.bankDetails.accountNumber || '',
        bankName: u.bankDetails.bankName || '',
        branchName: u.bankDetails.branchName || '',
        swiftCode: u.bankDetails.swiftCode || '',
      }
      : null,
    createdAt: (u.createdAt && new Date(u.createdAt).toISOString()) || new Date().toISOString(),
    updatedAt: (u.updatedAt && new Date(u.updatedAt).toISOString()) || new Date().toISOString(),
  };
}

/**
 * GET /api/shops - paginated list of all shops (superadmin only)
 */
exports.getShops = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const status = req.query.status;
    const search = req.query.search;

    const query = { role: 'ADMIN' };
    if (status) {
      const backendStatus = CLIENT_TO_STATUS[status.toLowerCase()] || status.toUpperCase();
      if (['ACTIVE', 'PENDING', 'REJECTED', 'SUSPENDED'].includes(backendStatus)) {
        query.status = backendStatus;
      }
    }
    if (search && search.trim()) {
      const re = new RegExp(search.trim(), 'i');
      query.$or = [
        { shopName: re },
        { name: re },
        { email: re },
      ];
    }

    const total = await User.countDocuments(query);
    const totalPages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const users = await User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
    const shops = users.map((u) => userToShop(u));

    res.json({
      shops,
      pagination: { page, limit, total, totalPages },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/shops/my - current user's shop (vendor only)
 */
exports.getMyShop = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'ADMIN') return res.status(403).json({ message: 'Not a vendor account' });
    res.json(userToShop(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/shops/:id - single shop by id (superadmin only)
 */
exports.getShop = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'ADMIN' }).select('-password');
    if (!user) return res.status(404).json({ message: 'Shop not found' });
    res.json(userToShop(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PUT /api/shops/:id/status - update vendor status (superadmin only)
 * Body: { status: 'approved'|'pending'|'rejected'|'suspended', reason?: string }
 */
exports.updateShopStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const backendStatus = status ? (CLIENT_TO_STATUS[status.toLowerCase()] || status.toUpperCase()) : null;
    if (!backendStatus || !['ACTIVE', 'PENDING', 'REJECTED', 'SUSPENDED'].includes(backendStatus)) {
      return res.status(400).json({ message: 'Invalid status. Use approved, pending, rejected, or suspended.' });
    }

    const update = { status: backendStatus };
    if (backendStatus === 'REJECTED' && reason != null) {
      update.rejectionReason = String(reason);
    } else if (backendStatus !== 'REJECTED') {
      update.rejectionReason = null;
    }

    const vendor = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'ADMIN' },
      update,
      { new: true }
    ).select('-password');

    if (!vendor) return res.status(404).json({ message: 'Shop not found' });
    res.json(userToShop(vendor));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PUT /api/shops/:id/commission - update commission rate (superadmin only)
 * Body: { commissionRate: number }
 */
exports.updateShopCommission = async (req, res) => {
  try {
    const { commissionRate } = req.body;
    if (commissionRate === undefined || commissionRate === null) {
      return res.status(400).json({ message: 'commissionRate is required' });
    }
    const rate = Number(commissionRate);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      return res.status(400).json({ message: 'Commission rate must be between 0 and 100' });
    }

    const vendor = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'ADMIN' },
      { commissionRate: rate },
      { new: true }
    ).select('-password');

    if (!vendor) return res.status(404).json({ message: 'Shop not found' });
    res.json(userToShop(vendor));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PUT /api/shops/my - update current user's shop (vendor only)
 * PUT /api/shops/:id - update shop (superadmin or owner)
 */
exports.updateMyShop = exports.updateShop = async (req, res) => {
  try {
    const id = req.params.id || req.user.id;
    const isOwn = id?.toString() === req.user.id?.toString();
    const user = await User.findOne({ _id: id, role: 'ADMIN' });
    if (!user) return res.status(404).json({ message: 'Shop not found' });
    if (!isOwn && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'You can only update your own shop' });
    }

    const allowed = ['shopName', 'shopDescription', 'description', 'phone', 'address', 'businessRegistration', 'logoUrl'];
    const updates = {};
    const body = req.body || {};
    allowed.forEach((key) => {
      if (body[key] !== undefined) updates[key] = body[key];
    });
    if (body.bankDetails && typeof body.bankDetails === 'object') {
      const bankFields = ['accountHolderName', 'accountNumber', 'bankName', 'branchName', 'swiftCode'];
      updates.bankDetails = {};
      bankFields.forEach((key) => {
        if (body.bankDetails[key] !== undefined) {
          updates.bankDetails[key] = String(body.bankDetails[key]).trim();
        }
      });
    }
    if (Object.keys(updates).length === 0) {
      return res.json(userToShop(user));
    }

    const updated = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
    res.json(userToShop(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
