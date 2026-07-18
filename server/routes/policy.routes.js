const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policy.controller');
const { verifyToken } = require('../middleware/authMiddleware');

// Specific routes FIRST (before generic :policyType route)
router.get('/search', policyController.searchPolicies);
router.get('/utils/return-policy', policyController.getReturnPolicyForCategory);
router.get('/utils/shipping-policy', policyController.getShippingPolicy);
router.get('/admin/all', verifyToken, policyController.getAllPolicies);
router.get('/admin/versions/:policyType', verifyToken, policyController.getPolicyVersionHistory);

// Public routes
router.get('/', policyController.getAllPublicPolicies);
router.get('/:policyType/faq', policyController.getPolicyWithFAQ);
router.get('/:policyType', policyController.getPolicy);

// Admin routes
router.post('/', verifyToken, policyController.createPolicy);
router.put('/:policyType', verifyToken, policyController.updatePolicy);
router.post('/:policyType/faq', verifyToken, policyController.addFAQItem);
router.patch('/:policyType/deactivate', verifyToken, policyController.deactivatePolicy);

module.exports = router;
