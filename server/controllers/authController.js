const User = require('../models/user')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, shopName } = req.body;

    if (role === 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Cannot register as Super Admin.' });
    }

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name,
      email,
      password: hashedPassword,
      role,
      shopName: role === 'ADMIN' ? shopName : undefined
    });

    await user.save();

    res.status(201).json({
      message: role === 'ADMIN'
        ? 'Registration successful! Wait for Super Admin approval.'
        : 'Registration successful!'
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

/**
 * POST /auth/register/seller - seller signup (fullName, shopName, etc.)
 * Creates user with role ADMIN (status PENDING via pre-save hook).
 */
exports.registerSeller = async (req, res) => {
  try {
    const { fullName, email, password, shopName, businessRegistration, shopDescription, phone, address } = req.body;

    if (!fullName || !email || !password || !shopName) {
      return res.status(400).json({ message: 'fullName, email, password and shopName are required' });
    }

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name: fullName,
      email,
      password: hashedPassword,
      role: 'ADMIN',
      shopName,
      phone: phone || undefined,
      businessRegistration: businessRegistration || undefined,
      shopDescription: shopDescription || undefined,
      address: address || undefined,
    });

    await user.save();

    // Return tokens so client can stay logged in (seller will see pending state)
    const payload = { user: { id: user.id, role: user.role } };
    jwt.sign(payload, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' }, (err, token) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
      }
      const roleLower = (user.role || '').toLowerCase().replace('_', '');
      res.status(201).json({
        message: 'Registration successful! Wait for Super Admin approval.',
        accessToken: token,
        refreshToken: token,
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
        },
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};

// Map backend status to client-friendly (for getMe shop)
const STATUS_TO_CLIENT = { ACTIVE: 'approved', PENDING: 'pending', REJECTED: 'rejected', SUSPENDED: 'suspended' };

// GET /auth/me - return current user from JWT with profile and shop (for admins)
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const roleLower = (user.role || '').toLowerCase().replace('_', '');
    const role = roleLower === 'superadmin' ? 'superadmin' : roleLower === 'admin' ? 'admin' : 'customer';

    const response = {
      id: user.id,
      email: user.email,
      fullName: user.name,
      role,
      userRoles: [{ role }],
      profile: {
        id: user._id.toString(),
        userId: user._id.toString(),
        fullName: user.name,
        email: user.email,
        phone: user.phone || null,
        address: user.address || null,
        createdAt: user.createdAt && new Date(user.createdAt).toISOString(),
        updatedAt: user.updatedAt && new Date(user.updatedAt).toISOString(),
      },
    };

    if (user.role === 'ADMIN') {
      response.shop = {
        id: user._id.toString(),
        name: user.shopName || user.name || '',
        description: user.shopDescription || null,
        logoUrl: user.logoUrl || null,
        ownerId: user._id.toString(),
        status: STATUS_TO_CLIENT[user.status] || user.status?.toLowerCase() || 'pending',
        email: user.email || null,
        phone: user.phone || null,
        address: user.address || null,
        businessRegistration: user.businessRegistration || null,
        commissionRate: user.commissionRate != null ? user.commissionRate : 10,
        createdAt: (user.createdAt && new Date(user.createdAt).toISOString()) || new Date().toISOString(),
        updatedAt: (user.updatedAt && new Date(user.updatedAt).toISOString()) || new Date().toISOString(),
      };
    }

    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
};