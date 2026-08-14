const User = require('../models/user');

const toClientProfile = (user) => ({
  id: user._id.toString(),
  user_id: user._id.toString(),
  email: user.email,
  full_name: user.name,
  phone: user.phone || null,
  address: user.address || null,
  city: user.city || null,
  postal_code: user.postalCode || null,
  avatar_url: user.avatarUrl || null,
  created_at: (user.createdAt && new Date(user.createdAt).toISOString()) || null,
  updated_at: (user.updatedAt && new Date(user.updatedAt).toISOString()) || null,
});

/**
 * GET /api/users/:id/profile - get minimal profile for a user (superadmin or self)
 * Returns shape expected by client: full_name, email, phone, etc.
 */
exports.getProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;
    // Allow superadmin or the user themselves
    const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
    const isSelf = currentUser.id === id;
    if (!isSuperAdmin && !isSelf) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const user = await User.findById(id).select('name email phone address city postalCode avatarUrl createdAt updatedAt');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(toClientProfile(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/users/profile - get current user's profile
 */
exports.getMyProfile = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const user = await User.findById(userId).select('name email phone address city postalCode avatarUrl createdAt updatedAt');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(toClientProfile(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PUT /api/users/profile - update current user's profile
 */
exports.updateMyProfile = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { full_name, name, phone, address, city, postalCode, postal_code, avatarUrl, avatar_url } = req.body || {};

    const updates = {};
    if (typeof full_name === 'string' || typeof name === 'string') {
      updates.name = String(full_name || name).trim();
    }
    if (phone !== undefined) updates.phone = phone;
    if (address !== undefined) updates.address = address;
    if (city !== undefined) updates.city = city;
    if (postalCode !== undefined || postal_code !== undefined) updates.postalCode = postalCode || postal_code;
    if (avatarUrl !== undefined || avatar_url !== undefined) updates.avatarUrl = avatarUrl || avatar_url;

    const user = await User.findByIdAndUpdate(userId, updates, { new: true, runValidators: true })
      .select('name email phone address city postalCode avatarUrl createdAt updatedAt');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(toClientProfile(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
