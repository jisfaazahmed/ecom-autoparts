const User = require('../models/user.model');
const Order = require('../models/order.model');

exports.getDashboardStats = async (req, res) => {
  try {
    // 1. Count total users
    const totalUsers = await User.countDocuments();
    
    // 2. Count active shops (Admins who are NOT the HQ Super Admin)
    const activeShops = await User.countDocuments({ role: 'ADMIN', shopName: { $ne: 'HQ' } });
    
    // 3. Count total orders
    const totalOrders = await Order.countDocuments();

    // 4. Count pending approvals (Vital for your next step)
    const pendingApprovals = await User.countDocuments({ status: 'PENDING' });

    res.json({
      totalUsers,
      activeShops,
      totalOrders,
      pendingApprovals
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};