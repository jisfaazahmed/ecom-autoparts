const User = require('../models/user')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { name, fullName, email, password, role, shopName } = req.body;
    const displayName = name || fullName;
    const normalizedRole = role || 'CUSTOMER';

    if (normalizedRole === 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Cannot register as Super Admin.' });
    }

    if (!displayName || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name: displayName,
      email,
      password: hashedPassword,
      role: normalizedRole,
      shopName: normalizedRole === 'ADMIN' ? shopName : undefined,
    });

    await user.save();

    const payload = { user: { id: user.id, role: user.role } };
    jwt.sign(payload, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' }, (err, token) => {
      if (err) throw err;
      const roleLower = (user.role || '').toLowerCase().replace('_', '');
      const mappedRole = roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer';
      res.status(201).json({
        message: normalizedRole === 'ADMIN'
          ? 'Registration successful! Wait for Super Admin approval.'
          : 'Registration successful!',
        accessToken: token,
        refreshToken: token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.name,
          role: mappedRole,
          status: user.status,
          shopName: user.shopName,
          commissionRate: user.commissionRate,
          createdAt: user.createdAt,
        },
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
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

    jwt.sign(payload, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' }, (err, token) => {
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
          status: user.status,
          shopName: user.shopName,
          commissionRate: user.commissionRate,
          createdAt: user.createdAt,
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
    res.json({
      id: user.id,
      email: user.email,
      fullName: user.name,
      role: roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer',
      status: user.status,
      shopName: user.shopName,
      commissionRate: user.commissionRate,
      createdAt: user.createdAt,
      userRoles: [{ role: roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer' }],
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};