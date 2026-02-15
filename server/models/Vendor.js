const { v4: uuidv4 } = require('uuid');

/**
 * Vendor Model
 * Represents a vendor/shop owner in the system
 */
class Vendor {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.shopName = data.shopName;
    this.businessRegistrationNumber = data.businessRegistrationNumber;
    this.email = data.email;
    this.phone = data.phone;
    this.ownerName = data.ownerName;
    this.address = data.address || null;
    this.description = data.description || null;
    this.logoUrl = data.logoUrl || null;
    this.status = data.status || 'pending'; // pending, approved, rejected, suspended
    this.commissionRate = data.commissionRate || 10; // percentage
    this.documents = data.documents || []; // Array of document URLs
    this.rejectionReason = data.rejectionReason || null;
    this.approvedBy = data.approvedBy || null;
    this.approvedAt = data.approvedAt || null;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  /**
   * Validate vendor data
   */
  static validate(data) {
    const errors = [];

    // Shop name validation
    if (!data.shopName || data.shopName.trim().length < 3) {
      errors.push('Shop name must be at least 3 characters long');
    }

    // Business registration number validation
    if (!data.businessRegistrationNumber || data.businessRegistrationNumber.trim().length === 0) {
      errors.push('Business registration number is required');
    }

    // Email validation
    if (!data.email || !this.isValidEmail(data.email)) {
      errors.push('Valid email address is required');
    }

    // Phone validation
    if (!data.phone || data.phone.trim().length < 10) {
      errors.push('Valid phone number is required (minimum 10 digits)');
    }

    // Owner name validation
    if (!data.ownerName || data.ownerName.trim().length < 3) {
      errors.push('Owner name must be at least 3 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Email validation helper
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Update vendor status
   */
  updateStatus(status, adminId = null, reason = null) {
    this.status = status;
    this.updatedAt = new Date().toISOString();

    if (status === 'approved') {
      this.approvedBy = adminId;
      this.approvedAt = new Date().toISOString();
      this.rejectionReason = null;
    } else if (status === 'rejected') {
      this.rejectionReason = reason;
      this.approvedBy = null;
      this.approvedAt = null;
    } else if (status === 'suspended') {
      this.rejectionReason = reason;
    }

    return this;
  }

  /**
   * Update commission rate
   */
  updateCommissionRate(rate) {
    if (rate < 0 || rate > 100) {
      throw new Error('Commission rate must be between 0 and 100');
    }
    this.commissionRate = rate;
    this.updatedAt = new Date().toISOString();
    return this;
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      id: this.id,
      shopName: this.shopName,
      businessRegistrationNumber: this.businessRegistrationNumber,
      email: this.email,
      phone: this.phone,
      ownerName: this.ownerName,
      address: this.address,
      description: this.description,
      logoUrl: this.logoUrl,
      status: this.status,
      commissionRate: this.commissionRate,
      documents: this.documents,
      rejectionReason: this.rejectionReason,
      approvedBy: this.approvedBy,
      approvedAt: this.approvedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Vendor;