const User = require('../models/user');

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

    const user = await User.findById(id).select('name email phone address city postalCode createdAt updatedAt');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      id: user._id.toString(),
      user_id: user._id.toString(),
      email: user.email,
      full_name: user.name,
      phone: user.phone || null,
      address: user.address || null,
      city: user.city || null,
      postal_code: user.postalCode || null,
      created_at: (user.createdAt && new Date(user.createdAt).toISOString()) || null,
      updated_at: (user.updatedAt && new Date(user.updatedAt).toISOString()) || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
