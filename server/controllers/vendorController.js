const User = require('../models/user');

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
    const normalizedStatus = String(status || '').toUpperCase();
    const allowedStatuses = new Set(['ACTIVE', 'PENDING', 'REJECTED', 'SUSPENDED']);

    if (!allowedStatuses.has(normalizedStatus)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const vendor = await User.findByIdAndUpdate(
      req.params.id,
      { status: normalizedStatus },
      { new: true, runValidators: true }
    ).select('-password');

    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    res.json({ message: `Vendor status updated to ${normalizedStatus}`, vendor });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};

// UPDATE Commission Rate (Usage: PATCH /api/vendors/:id/commission)
exports.updateVendorCommission = async (req, res) => {
  try {
    const { commissionRate } = req.body;
    const rate = Number(commissionRate);

    if (Number.isNaN(rate)) {
      return res.status(400).json({ message: 'Commission rate must be a number' });
    }

    if (rate < 0 || rate > 100) {
      return res.status(400).json({ message: 'Commission rate must be between 0 and 100' });
    }

    const vendor = await User.findByIdAndUpdate(
      req.params.id,
      { commissionRate: rate },
      { new: true, runValidators: true }
    ).select('-password');

    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    res.json({ message: `Vendor commission updated to ${rate}`, vendor });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
};