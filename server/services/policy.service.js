const Policy = require('../models/policy.model');

class PolicyService {
  /**
   * Get active policy by type
   */
  async getPolicyByType(policyType) {
    try {
      const policy = await Policy.findOne({
        policyType,
        isActive: true,
      }).sort({ version: -1 });

      if (!policy) {
        throw new Error(`Policy of type ${policyType} not found`);
      }

      return policy;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all active policies for public display
   */
  async getActivePolicies() {
    try {
      const policies = await Policy.find({ isActive: true })
        .sort({ 'displaySettings.displayOrder': 1 })
        .select('-modifiedBy');

      return policies;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all policies (admin)
   */
  async getAllPolicies(filters = {}) {
    try {
      const query = {};

      if (filters.policyType) {
        query.policyType = filters.policyType;
      }

      if (filters.isActive !== undefined) {
        query.isActive = filters.isActive;
      }

      const policies = await Policy.find(query)
        .populate('modifiedBy', 'name email')
        .sort({ createdAt: -1 });

      return policies;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create new policy
   */
  async createPolicy(policyData, userId) {
    try {
      const { policyType, title, description, content, sections, metadata, displaySettings } = policyData;

      // Check if policy type already exists
      const existing = await Policy.findOne({ policyType });
      if (existing) {
        throw new Error(`Policy of type ${policyType} already exists. Use update instead.`);
      }

      const policy = new Policy({
        policyType,
        title,
        description,
        content,
        sections: sections || [],
        metadata: metadata || {},
        displaySettings: displaySettings || { showInFooter: true },
        modifiedBy: userId,
        version: 1,
      });

      await policy.save();
      return policy;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update policy (creates new version, deactivates old)
   */
  async updatePolicy(policyType, updateData, userId) {
    try {
      const oldPolicy = await Policy.findOne({ policyType });

      if (!oldPolicy) {
        throw new Error(`Policy of type ${policyType} not found`);
      }

      // Deactivate old version
      oldPolicy.isActive = false;
      await oldPolicy.save();

      // Create new version
      const newPolicy = new Policy({
        policyType,
        title: updateData.title || oldPolicy.title,
        description: updateData.description || oldPolicy.description,
        content: updateData.content || oldPolicy.content,
        sections: updateData.sections || oldPolicy.sections,
        metadata: updateData.metadata || oldPolicy.metadata,
        displaySettings: updateData.displaySettings || oldPolicy.displaySettings,
        faqItems: updateData.faqItems || oldPolicy.faqItems,
        contactInfo: updateData.contactInfo || oldPolicy.contactInfo,
        applicableCategories: updateData.applicableCategories || oldPolicy.applicableCategories,
        modifiedBy: userId,
        version: oldPolicy.version + 1,
        isActive: true,
      });

      await newPolicy.save();
      return newPolicy;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get policy with FAQ
   */
  async getPolicyWithFAQ(policyType) {
    try {
      const policy = await Policy.findOne({
        policyType,
        isActive: true,
      });

      if (!policy) {
        throw new Error(`Policy of type ${policyType} not found`);
      }

      return {
        ...policy.toObject(),
        faqCount: policy.faqItems?.length || 0,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Add FAQ to policy
   */
  async addFAQItem(policyType, faqData) {
    try {
      const policy = await Policy.findOne({ policyType, isActive: true });

      if (!policy) {
        throw new Error(`Policy of type ${policyType} not found`);
      }

      policy.faqItems = policy.faqItems || [];
      policy.faqItems.push({
        question: faqData.question,
        answer: faqData.answer,
        category: faqData.category || 'General',
      });

      await policy.save();
      return policy;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get return policy details for product category
   */
  async getReturnPolicyForCategory(category = 'all') {
    try {
      const policy = await Policy.findOne({
        policyType: 'return',
        isActive: true,
        $or: [
          { applicableCategories: { $size: 0 } },
          { applicableCategories: category },
          { applicableCategories: 'all' }
        ]
      });

      if (!policy) {
        // Return default
        return {
          returnDays: 14,
          extendedForDefects: 30,
          restockingFeePercentage: 0,
        };
      }

      return {
        returnDays: policy.metadata?.returnDays || 14,
        extendedForDefects: policy.metadata?.extendedForDefects || 30,
        restockingFeePercentage: policy.metadata?.restockingFeePercentage || 0,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get shipping policy details
   */
  async getShippingPolicy() {
    try {
      const policy = await Policy.findOne({
        policyType: 'shipping',
        isActive: true,
      });

      if (!policy) {
        return {
          freeShippingThreshold: 5000,
          shippingChargePolicy: 'tiered',
        };
      }

      return {
        freeShippingThreshold: policy.metadata?.freeShippingThreshold || 5000,
        shippingChargePolicy: policy.metadata?.shippingChargePolicy || 'tiered',
        content: policy.content,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Deactivate policy (soft delete)
   */
  async deactivatePolicy(policyType, userId) {
    try {
      const policy = await Policy.findOneAndUpdate(
        { policyType },
        { isActive: false, modifiedBy: userId, lastModified: new Date() },
        { new: true }
      );

      if (!policy) {
        throw new Error(`Policy of type ${policyType} not found`);
      }

      return policy;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Search policies
   */
  async searchPolicies(searchTerm, filters = {}) {
    try {
      const query = {
        isActive: filters.isActive !== undefined ? filters.isActive : true,
        $or: [
          { title: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { content: { $regex: searchTerm, $options: 'i' } }
        ]
      };

      const policies = await Policy.find(query)
        .limit(20)
        .sort({ createdAt: -1 });

      return policies;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get policy version history
   */
  async getPolicyVersionHistory(policyType) {
    try {
      const policies = await Policy.find({ policyType })
        .sort({ version: -1 })
        .select('-content -faqItems')
        .limit(10);

      return policies;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new PolicyService();
