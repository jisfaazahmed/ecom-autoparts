const VendorService = require('../services/vendor.service');
const ApiResponse = require('../utils/response');

/**
 * Vendor Controller
 * Handles HTTP requests for vendor management
 */
class VendorController {
  /**
   * Get all vendors
   * GET /api/vendors
   * Query params: ?status=pending&search=shop
   */
  static async getAllVendors(req, res, next) {
    try {
      const { status, search } = req.query;
      const filters = {};

      if (status) filters.status = status;
      if (search) filters.search = search;

      const vendors = await VendorService.getAllVendors(filters);

      return ApiResponse.success(
        res,
        vendors,
        `Retrieved ${vendors.length} vendor(s)`,
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get vendor by ID
   * GET /api/vendors/:id
   */
  static async getVendorById(req, res, next) {
    try {
      const { id } = req.params;
      const vendor = await VendorService.getVendorById(id);

      return ApiResponse.success(res, vendor, 'Vendor retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new vendor (registration)
   * POST /api/vendors
   */
  static async createVendor(req, res, next) {
    try {
      const vendorData = req.body;
      const vendor = await VendorService.createVendor(vendorData);

      return ApiResponse.created(
        res,
        vendor,
        'Vendor registration submitted successfully. Awaiting admin approval.'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve vendor
   * PUT /api/vendors/:id/approve
   */
  static async approveVendor(req, res, next) {
    try {
      const { id } = req.params;
      const { adminId } = req.body;

      if (!adminId) {
        return ApiResponse.badRequest(res, 'Admin ID is required');
      }

      const vendor = await VendorService.approveVendor(id, adminId);

      return ApiResponse.success(
        res,
        vendor,
        `Vendor "${vendor.shopName}" approved successfully`
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Reject vendor
   * PUT /api/vendors/:id/reject
   */
  static async rejectVendor(req, res, next) {
    try {
      const { id } = req.params;
      const { adminId, reason } = req.body;

      if (!adminId) {
        return ApiResponse.badRequest(res, 'Admin ID is required');
      }

      if (!reason) {
        return ApiResponse.badRequest(res, 'Rejection reason is required');
      }

      const vendor = await VendorService.rejectVendor(id, adminId, reason);

      return ApiResponse.success(
        res,
        vendor,
        `Vendor "${vendor.shopName}" rejected`
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Suspend vendor
   * PUT /api/vendors/:id/suspend
   */
  static async suspendVendor(req, res, next) {
    try {
      const { id } = req.params;
      const { adminId, reason } = req.body;

      if (!adminId) {
        return ApiResponse.badRequest(res, 'Admin ID is required');
      }

      if (!reason) {
        return ApiResponse.badRequest(res, 'Suspension reason is required');
      }

      const vendor = await VendorService.suspendVendor(id, adminId, reason);

      return ApiResponse.success(
        res,
        vendor,
        `Vendor "${vendor.shopName}" suspended`
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update vendor commission rate
   * PUT /api/vendors/:id/commission
   */
  static async updateCommissionRate(req, res, next) {
    try {
      const { id } = req.params;
      const { commissionRate } = req.body;

      if (commissionRate === undefined) {
        return ApiResponse.badRequest(res, 'Commission rate is required');
      }

      const vendor = await VendorService.updateCommissionRate(id, commissionRate);

      return ApiResponse.success(
        res,
        vendor,
        `Commission rate updated to ${commissionRate}% for "${vendor.shopName}"`
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get vendor statistics
   * GET /api/vendors/stats
   */
  static async getVendorStats(req, res, next) {
    try {
      const stats = await VendorService.getVendorStats();

      return ApiResponse.success(res, stats, 'Vendor statistics retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete vendor
   * DELETE /api/vendors/:id
   */
  static async deleteVendor(req, res, next) {
    try {
      const { id } = req.params;
      await VendorService.deleteVendor(id);

      return ApiResponse.success(res, null, 'Vendor deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = VendorController;