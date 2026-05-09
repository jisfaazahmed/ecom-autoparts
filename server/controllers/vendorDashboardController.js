const mongoose = require('mongoose');
const VendorProduct = require('../models/vendorProduct');
const Order = require('../models/order.model');

const cancelledStatuses = ['CANCELLED', 'Cancelled', 'cancelled'];

exports.getVendorDashboardStats = async (req, res) => {
  try {
    const vendorId = new mongoose.Types.ObjectId(req.user.id);

    const [products, ordersCount, salesAgg] = await Promise.all([
      VendorProduct.countDocuments({ vendor: vendorId }),
      Order.countDocuments({ vendor: vendorId }),
      Order.aggregate([
        {
          $match: {
            vendor: vendorId,
            status: { $nin: cancelledStatuses },
          },
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    const totalSalesLkr = salesAgg.length ? salesAgg[0].total : 0;

    res.json({
      products,
      orders: ordersCount,
      totalSalesLkr,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};
