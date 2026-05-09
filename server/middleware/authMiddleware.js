const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

<<<<<<< HEAD
// 1. Verify Token (Is user logged in?)
exports.verifyToken = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    const secret = process.env.JWT_SECRET || 'mysecretkey123';
    const decoded = jwt.verify(token, secret);
    req.user = decoded.user;
    next();
  } catch (err) {
=======
function buildMockUser() {
  return {
    _id: process.env.MOCK_AUTH_USER_ID || '000000000000000000000001',
    id: process.env.MOCK_AUTH_USER_ID || '000000000000000000000001',
    role: process.env.MOCK_AUTH_ROLE || 'customer',
    email: process.env.MOCK_AUTH_EMAIL || 'mock-customer@example.com',
  };
}

function decodeAuthToken(req) {
  const authHeader = req.header('Authorization');
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = bearerToken || req.header('x-auth-token');
  if (!token) return null;

  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
  return decoded.user;
}

// 1. Verify Token (Is user logged in?)
exports.verifyToken = (req, res, next) => {
  const allowMock = process.env.USE_AUTH_MOCK === 'true';

  try {
    const user = decodeAuthToken(req);
    if (!user) {
      if (!allowMock) {
        return res.status(401).json({ message: 'No token, authorization denied' });
      }
      req.user = buildMockUser();
      return next();
    }

    req.user = user;
    next();
  } catch (err) {
    if (allowMock) {
      req.user = buildMockUser();
      return next();
    }
>>>>>>> origin/feature/seller
    res.status(401).json({ message: 'Token is not valid' });
  }
};

<<<<<<< HEAD
// 2. Verify Super Admin (Is user the Boss?)
exports.isSuperAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Super Admin only.' });
    }
    next();
  } catch (err) {
    res.status(500).send('Server Error');
  }
};

exports.requireVendor = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Vendor access only.' });
  }
  next();
=======
// Optional authentication for mixed guest/auth endpoints (e.g., COD guest checkout)
exports.attachUserIfPresent = (req, _res, next) => {
  const allowMock = process.env.USE_AUTH_MOCK === 'true';

  try {
    const user = decodeAuthToken(req);
    if (user) {
      req.user = user;
    } else if (allowMock) {
      req.user = buildMockUser();
    }
  } catch (_err) {
    if (allowMock) {
      req.user = buildMockUser();
    }
  }

  next();
};

// 2. Verify Super Admin (Is user the Boss?)
exports.isSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const normalizeRole = (role) => String(role || '').replace(/_/g, '').toUpperCase();
    const tokenRole = normalizeRole(req.user.role);
    const userId = req.user.id || req.user._id || req.user.userId;

    // Legacy/test tokens may carry non-ObjectId identifiers (e.g., "test").
    // In that case, fall back to the verified JWT role to avoid CastError crashes.
    if (!userId || !/^[a-fA-F0-9]{24}$/.test(String(userId))) {
      if (tokenRole === 'SUPERADMIN') {
        return next();
      }
      return res.status(403).json({ message: 'Access denied. Super Admin only.' });
    }

    const user = await User.findById(userId).select('role');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (normalizeRole(user.role) !== 'SUPERADMIN') {
      return res.status(403).json({ message: 'Access denied. Super Admin only.' });
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
>>>>>>> origin/feature/seller
};