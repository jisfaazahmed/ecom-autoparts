const User = require('../models/user')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    // Accept both 'name' and 'fullName' from frontend
    const { name, fullName, email, password, role, shopName, phone } = req.body;
    const userName = name || fullName;

    if (!userName || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }

    if (role === 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Cannot register as Super Admin.' });
    }

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name: userName,
      email,
      password: hashedPassword,
      phone: phone || undefined,
      role: role || 'CUSTOMER',
      shopName: role === 'ADMIN' ? shopName : undefined,
      // Customers are auto-active; sellers need Super Admin approval
      status: role === 'ADMIN' ? 'PENDING' : 'ACTIVE',
    });

    await user.save();

    // Return token so the frontend can auto-login after registration
    const payload = { user: { id: user.id, role: user.role } };
    const roleLower = (user.role || '').toLowerCase().replace('_', '');
    const mappedRole = roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer';

    jwt.sign(payload, 'secret123', { expiresIn: '1d' }, (err, token) => {
      if (err) throw err;
      res.status(201).json({
        accessToken: token,
        refreshToken: token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.name,
          role: mappedRole,
        },
        message: role === 'ADMIN'
          ? 'Registration successful! Wait for Super Admin approval.'
          : 'Registration successful!',
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid Credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid Credentials' });

    // GATEKEEPER CHECK
    if (user.status === 'PENDING') return res.status(403).json({ message: 'Account pending approval.' });
    if (user.status === 'REJECTED') return res.status(403).json({ message: 'Account rejected.' });

    const payload = { user: { id: user.id, role: user.role } };

    jwt.sign(payload, 'secret123', { expiresIn: '1d' }, (err, token) => {
      if (err) throw err;
      // Client expects accessToken and user (role normalized to lowercase)
      const roleLower = (user.role || '').toLowerCase().replace('_', '');
      res.json({
        accessToken: token,
        refreshToken: token, // optional: same token for now
        user: {
          id: user.id,
          email: user.email,
          fullName: user.name,
          role: roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer',
        },
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

// GET /auth/me - return current user from JWT
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const roleLower = (user.role || '').toLowerCase().replace('_', '');
    const mappedRole = roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer';
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.name,
      phone: user.phone || null,
      address: user.address || null,
      city: user.city || null,
      postalCode: user.postalCode || null,
      avatarUrl: user.avatarUrl || null,
      role: mappedRole,
      userRoles: [{ role: mappedRole }],
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

// PUT /auth/profile - update current user profile
exports.updateProfile = async (req, res) => {
  try {
    const { fullName, phone, address, city, postalCode } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (fullName !== undefined) user.name = fullName.trim();
    if (phone !== undefined) user.phone = phone || null;
    if (address !== undefined) user.address = address || null;
    if (city !== undefined) user.city = city || null;
    if (postalCode !== undefined) user.postalCode = postalCode || null;

    await user.save();

    const roleLower = (user.role || '').toLowerCase().replace('_', '');
    const mappedRole = roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer';
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.name,
      phone: user.phone || null,
      address: user.address || null,
      city: user.city || null,
      postalCode: user.postalCode || null,
      avatarUrl: user.avatarUrl || null,
      role: mappedRole,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

// POST /auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to change password' });
  }
};