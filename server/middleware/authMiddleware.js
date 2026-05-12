const jwt = require('jsonwebtoken');
const User = require('../models/user');

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
  try {
    const user = decodeAuthToken(req);
    if (!user) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Optional authentication for mixed guest/auth endpoints (e.g., COD guest checkout)
exports.attachUserIfPresent = (req, _res, next) => {
  try {
    const user = decodeAuthToken(req);
    if (user) {
      req.user = user;
    }
  } catch (_err) {
    // Ignore malformed tokens on optional auth paths.
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
};