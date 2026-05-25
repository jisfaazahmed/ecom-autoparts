const policyService = require('../services/policy.service');

const normalizeRole = (role) => String(role || '').toLowerCase().replace(/_/g, '');
const Policy = require('../models/policy.model');

// Public endpoints
exports.getPolicy = async (req, res) => {
  try {
    const { policyType } = req.params;

    if (!policyType) {
      return res.status(400).json({
        success: false,
        message: 'Policy type is required'
      });
    }

    const policy = await policyService.getPolicyByType(policyType);

    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message || 'Policy not found'
    });
  }
};

exports.getAllPublicPolicies = async (req, res) => {
  try {
    const policies = await policyService.getActivePolicies();

    res.json({
      success: true,
      data: policies,
      count: policies.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getPolicyWithFAQ = async (req, res) => {
  try {
    const { policyType } = req.params;

    if (!policyType) {
      return res.status(400).json({
        success: false,
        message: 'Policy type is required'
      });
    }

    const policy = await policyService.getPolicyWithFAQ(policyType);

    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message || 'Policy not found'
    });
  }
};

exports.searchPolicies = async (req, res) => {
  try {
    const { q, isActive } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search term must be at least 2 characters'
      });
    }

    const policies = await policyService.searchPolicies(q, { isActive });

    res.json({
      success: true,
      data: policies,
      count: policies.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Admin endpoints
exports.createPolicy = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const role = normalizeRole(req.user?.role);

    if (!['admin', 'superadmin'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const policy = await policyService.createPolicy(req.body, userId);

    res.status(201).json({
      success: true,
      message: 'Policy created successfully',
      data: policy
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.updatePolicy = async (req, res) => {
  try {
    const { policyType } = req.params;
    const userId = req.user?.id || req.user?._id;
    const role = normalizeRole(req.user?.role);

    if (!['admin', 'superadmin'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const policy = await policyService.updatePolicy(policyType, req.body, userId);

    res.json({
      success: true,
      message: 'Policy updated successfully',
      data: policy
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.getAllPolicies = async (req, res) => {
  try {
    const role = normalizeRole(req.user?.role);

    if (!['admin', 'superadmin'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const { policyType, isActive } = req.query;
    const policies = await policyService.getAllPolicies({
      policyType,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined
    });

    res.json({
      success: true,
      data: policies,
      count: policies.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getPolicyVersionHistory = async (req, res) => {
  try {
    const { policyType } = req.params;
    const role = normalizeRole(req.user?.role);

    if (!['admin', 'superadmin'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const versions = await policyService.getPolicyVersionHistory(policyType);

    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.addFAQItem = async (req, res) => {
  try {
    const { policyType } = req.params;
    const role = normalizeRole(req.user?.role);

    if (!['admin', 'superadmin'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const policy = await policyService.addFAQItem(policyType, req.body);

    res.json({
      success: true,
      message: 'FAQ item added successfully',
      data: policy
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.deactivatePolicy = async (req, res) => {
  try {
    const { policyType } = req.params;
    const userId = req.user?.id || req.user?._id;
    const role = normalizeRole(req.user?.role);

    if (!['admin', 'superadmin'].includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const policy = await policyService.deactivatePolicy(policyType, userId);

    res.json({
      success: true,
      message: 'Policy deactivated successfully',
      data: policy
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

exports.getReturnPolicyForCategory = async (req, res) => {
  try {
    const { category } = req.query;
    const policy = await policyService.getReturnPolicyForCategory(category || 'all');

    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getShippingPolicy = async (req, res) => {
  try {
    const policy = await policyService.getShippingPolicy();

    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
