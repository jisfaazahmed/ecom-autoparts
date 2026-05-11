const jwt = require('jsonwebtoken');
const User = require('../models/user');

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
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

  try {
    // In production, use process.env.JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123'); 
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// 2. Verify Super Admin (Is user the Boss?)
exports.isSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Super Admin only.' });
    }
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};