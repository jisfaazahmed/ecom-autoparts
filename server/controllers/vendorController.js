const User = require('../models/user');
const SettlementService = require('../services/settlement.service');
const VendorAnalyticsService = require('../services/vendorAnalytics.service');
const Settlement = require('../models/settlement.model');

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

// ========== ANALYTICS ENDPOINTS ==========

// GET vendor dashboard metrics (Usage: GET /api/vendors/:id/analytics?range=30d)
exports.getVendorAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { range = '30d' } = req.query;

    // Verify vendor exists
    const vendor = await User.findById(id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const metrics = await VendorAnalyticsService.getVendorDashboardMetrics(id, range);
    res.json(metrics);
  } catch (err) {
    console.error('Error fetching vendor analytics:', err);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
};

// GET time series analytics (Usage: GET /api/vendors/:id/analytics/timeseries?range=30d&granularity=daily)
exports.getTimeSeriesAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { range = '30d', granularity = 'daily' } = req.query;

    const timeSeries = await VendorAnalyticsService.getTimeSeriesAnalytics(id, range, granularity);
    res.json({ timeSeries });
  } catch (err) {
    console.error('Error fetching time series analytics:', err);
    res.status(500).json({ message: 'Error fetching time series' });
  }
};

// GET earnings breakdown (Usage: GET /api/vendors/:id/analytics/earnings?range=30d)
exports.getEarningsBreakdown = async (req, res) => {
  try {
    const { id } = req.params;
    const { range = '30d' } = req.query;

    const breakdown = await VendorAnalyticsService.getEarningsBreakdown(id, range);
    res.json(breakdown);
  } catch (err) {
    console.error('Error fetching earnings breakdown:', err);
    res.status(500).json({ message: 'Error fetching earnings breakdown' });
  }
};

// ========== SETTLEMENT / PAYOUT ENDPOINTS ==========

// GET current settlement summary for vendor (Usage: GET /api/vendors/:id/settlement/summary)
exports.getSettlementSummary = async (req, res) => {
  try {
    const { id } = req.params;

    const summary = await SettlementService.getVendorSettlementSummary(id);
    res.json(summary);
  } catch (err) {
    console.error('Error fetching settlement summary:', err);
    res.status(500).json({ message: 'Error fetching settlement summary' });
  }
};

// GET all settlements for vendor (Usage: GET /api/vendors/:id/settlements?status=pending&page=1&limit=10)
exports.getVendorSettlements = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    const result = await SettlementService.getVendorSettlements(id, {
      status,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching vendor settlements:', err);
    res.status(500).json({ message: 'Error fetching settlements' });
  }
};

// GET settlement details (Usage: GET /api/settlements/:settlementId)
exports.getSettlementDetails = async (req, res) => {
  try {
    const { settlementId } = req.params;

    const settlement = await SettlementService.getSettlementById(settlementId);
    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    res.json(settlement);
  } catch (err) {
    console.error('Error fetching settlement details:', err);
    res.status(500).json({ message: 'Error fetching settlement' });
  }
};

// GET total payable for vendor (Usage: GET /api/vendors/:id/payable)
exports.getTotalPayable = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await SettlementService.getTotalPayable(id);
    res.json(result);
  } catch (err) {
    console.error('Error calculating total payable:', err);
    res.status(500).json({ message: 'Error calculating payable amount' });
  }
};

// POST create settlement for vendor (Usage: POST /api/vendors/:id/settlement/create)
// Only for superadmin
exports.createVendorSettlement = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    // Verify vendor exists
    const vendor = await User.findById(id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Calculate settlement
    const settlementData = await SettlementService.calculateVendorSettlement(
      id,
      new Date(startDate),
      new Date(endDate)
    );

    // Create settlement record
    const settlement = await SettlementService.createSettlement(settlementData, req.user?.id);

    res.status(201).json(settlement);
  } catch (err) {
    console.error('Error creating settlement:', err);
    res.status(500).json({ message: 'Error creating settlement' });
  }
};

// PATCH update settlement status (Usage: PATCH /api/settlements/:settlementId/status)
// Only for superadmin
exports.updateSettlementStatus = async (req, res) => {
  try {
    const { settlementId } = req.params;
    const { status, ...updateData } = req.body;

    if (!status) {
      return res.status(400).json({ message: 'status is required' });
    }

    const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const settlement = await SettlementService.updateSettlementStatus(
      settlementId,
      status,
      updateData
    );

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found' });
    }

    res.json({ message: `Settlement status updated to ${status}`, settlement });
  } catch (err) {
    console.error('Error updating settlement status:', err);
    res.status(500).json({ message: 'Error updating settlement' });
  }
};

// POST process automated settlements (Usage: POST /api/vendors/settlement/process-all)
// Only for superadmin - triggers settlement for all vendors for a period
exports.processAutomatedSettlements = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required' });
    }

    const result = await SettlementService.processAutomatedSettlements(
      new Date(startDate),
      new Date(endDate),
      req.user?.id
    );

    res.json(result);
  } catch (err) {
    console.error('Error processing automated settlements:', err);
    res.status(500).json({ message: 'Error processing settlements' });
  }
};