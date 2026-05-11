const User = require('../models/user');

// 1. Get all pending users
exports.getPendingUsers = async (req, res) => {
  try {
    const users = await User.find({ status: 'PENDING' }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Approve or Reject a user
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Normalize to current user model statuses
    const normalized = String(status || '').toUpperCase();
    const mapped = normalized === 'APPROVED' ? 'ACTIVE' : normalized === 'REJECTED' ? 'REJECTED' : normalized;

    if (!['ACTIVE', 'REJECTED', 'SUSPENDED', 'PENDING'].includes(mapped)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const updatedUser = await User.findByIdAndUpdate(id, { status: mapped }, { new: true });
    
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: `User ${mapped.toLowerCase()} successfully`, user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Get all Approved Shops
exports.getAllShops = async (req, res) => {
  try {
    const shops = await User.find({ role: 'ADMIN', status: 'ACTIVE' }).select('-password');
    res.json(shops);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Get ALL Users (Super Admin, Admins, Customers)
exports.getAllCustomers = async (req, res) => {
  try {
    // Removed { role: 'USER' } to fetch everyone
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};