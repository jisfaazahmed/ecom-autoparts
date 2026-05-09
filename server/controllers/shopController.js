const User = require('../models/user');

/**
 * Shops Controller - Handles vendor shop endpoints
 * Maps User model to shop data structure
 */

// GET /api/shops/my - Get current user's shop info
exports.getMyShop = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const vendor = await User.findById(userId).select('-password -resetToken -resetTokenExpiry');
    if (!vendor) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Map User to Shop response format
    const shop = {
      id: vendor._id,
      name: vendor.shopName,
      description: vendor.description,
      ownerId: vendor._id,
      status: vendor.status ? vendor.status.toLowerCase() : 'active',
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      businessRegistration: vendor.businessRegistration,
      logoUrl: vendor.logoUrl,
      commissionRate: vendor.commissionRate,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt
    };

    res.json(shop);
  } catch (err) {
    console.error('Error fetching shop:', err);
    res.status(500).json({ message: 'Error fetching shop' });
  }
};

// GET /api/shops/:id - Get shop by ID
exports.getShop = async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await User.findById(id).select('-password -resetToken -resetTokenExpiry');
    
    if (!vendor) {
      return res.status(404).json({ message: 'Shop not found' });
    }

    // Only shop owners and superadmins can view shop details
    const userId = req.user?.id || req.user?._id;
    const role = req.user?.role || '';
    const isSuperAdmin = String(role).toLowerCase().includes('superadmin');
    
    if (userId?.toString() !== id.toString() && !isSuperAdmin) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const shop = {
      id: vendor._id,
      name: vendor.shopName,
      description: vendor.description,
      ownerId: vendor._id,
      status: vendor.status ? vendor.status.toLowerCase() : 'active',
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      businessRegistration: vendor.businessRegistration,
      logoUrl: vendor.logoUrl,
      commissionRate: vendor.commissionRate,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt
    };

    res.json(shop);
  } catch (err) {
    console.error('Error fetching shop:', err);
    res.status(500).json({ message: 'Error fetching shop' });
  }
};

// PUT /api/shops/my - Update current user's shop info
exports.updateMyShop = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const {
      name,
      description,
      phone,
      address,
      businessRegistration,
      logoUrl
    } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.shopName = name;
    if (description !== undefined) updateData.description = description;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (businessRegistration !== undefined) updateData.businessRegistration = businessRegistration;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (Object.keys(updateData).length === 0) {
      updateData.updatedAt = new Date();
    }

    const vendor = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetToken -resetTokenExpiry');

    if (!vendor) {
      return res.status(404).json({ message: 'User not found' });
    }

    const shop = {
      id: vendor._id,
      name: vendor.shopName,
      description: vendor.description,
      ownerId: vendor._id,
      status: vendor.status ? vendor.status.toLowerCase() : 'active',
      email: vendor.email,
      phone: vendor.phone,
      address: vendor.address,
      businessRegistration: vendor.businessRegistration,
      logoUrl: vendor.logoUrl,
      commissionRate: vendor.commissionRate,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt
    };

    res.json(shop);
  } catch (err) {
    console.error('Error updating shop:', err);
    res.status(500).json({ message: 'Error updating shop' });
  }
};
