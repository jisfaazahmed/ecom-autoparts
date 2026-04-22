const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

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
    res.status(401).json({ message: 'Token is not valid' });
  }
};

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
};