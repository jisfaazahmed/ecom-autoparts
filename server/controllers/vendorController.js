const User = require('../models/user.model');

// GET all vendors (Usage: /api/vendors?status=PENDING)
exports.getAllVendors = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { role: 'ADMIN' };
    
    if (status) query.status = status.toUpperCase();

    const vendors = await User.find(query).select('-password');
    res.json(vendors);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

// UPDATE Status (Usage: PATCH /api/vendors/:id/status)
exports.updateVendorStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const vendor = await User.findByIdAndUpdate(
      req.params.id,
      { status: status },
      { new: true }
    ).select('-password');

    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    res.json({ message: `Vendor status updated to ${status}`, vendor });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};