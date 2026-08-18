import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Eye, Loader2, AlertCircle, Copy } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface Policy {
  _id?: string;
  id?: string;
  policyType: string;
  title: string;
  description: string;
  isActive: boolean;
  version: number;
  createdAt?: string;
  modifiedBy?: unknown;
}

type PolicyType = 'return' | 'shipping' | 'cancellation' | 'terms_conditions' | 'privacy' | 'warranty';

interface PolicyForm {
  title: string;
  description: string;
  content: string;
  metadata?: {
    returnDays?: number;
    restockingFeePercentage?: number;
    freeShippingThreshold?: number;
  };
}

const PolicyTypeLabels: Record<string, string> = {
  return: '🔄 Return Policy',
  shipping: '🚚 Shipping Policy',
  cancellation: '❌ Cancellation Policy',
  terms_conditions: '📋 Terms & Conditions',
  privacy: '🔒 Privacy Policy',
  warranty: '⚠️ Warranty Policy',
};

const PolicyManager: React.FC = () => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPolicy, setEditingPolicy] = useState<string | null>(null);
  const [selectedPolicyType, setSelectedPolicyType] = useState<PolicyType | ''>('');
  const [formData, setFormData] = useState<PolicyForm>({
    title: '',
    description: '',
    content: '',
  });
  const [showDialog, setShowDialog] = useState(false);
  const [viewingPolicy, setViewingPolicy] = useState<Policy | null>(null);
  const [versions, setVersions] = useState<Policy[]>([]);

  // Load all policies
  const loadPolicies = async () => {
    try {
      setLoading(true);
      const data = await api.getAllPolicies();
      setPolicies(data);
    } catch (error) {
      toast.error('Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const handleEditPolicy = async (policyType: string) => {
    try {
      const policy = await api.getPolicy(policyType);
      setEditingPolicy(policyType);
      setSelectedPolicyType(policyType);
      setFormData({
        title: policy.title,
        description: policy.description,
        content: policy.content,
        metadata: policy.metadata,
      });
      setShowDialog(true);
    } catch (error) {
      toast.error('Failed to load policy for editing');
    }
  };

  const handleSavePolicy = async () => {
    if (!selectedPolicyType || !formData.title || !formData.content) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingPolicy) {
        await api.updatePolicy(editingPolicy, formData);
        toast.success('Policy updated successfully');
      } else {
        await api.createPolicy({
          policyType: selectedPolicyType,
          ...formData,
        });
        toast.success('Policy created successfully');
      }

      setShowDialog(false);
      setFormData({ title: '', description: '', content: '' });
      setSelectedPolicyType('');
      setEditingPolicy(null);
      await loadPolicies();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save policy');
    }
  };

  const handleViewVersions = async (policyType: string) => {
    try {
      const versionData = await api.getPolicyVersionHistory(policyType);
      setVersions(versionData);
      setViewingPolicy(policies.find((p) => p.policyType === policyType) || null);
    } catch (error) {
      toast.error('Failed to load version history');
    }
  };

  const handleDeactivatePolicy = async (policyType: string) => {
    if (!window.confirm('Are you sure you want to deactivate this policy?')) return;

    try {
      await api.deactivatePolicy(policyType);
      toast.success('Policy deactivated successfully');
      await loadPolicies();
    } catch (error) {
      toast.error('Failed to deactivate policy');
    }
  };

  const policyTypesList = Object.entries(PolicyTypeLabels).map(([key, label]) => ({
    value: key,
    label,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-200">Policy Management</h2>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingPolicy(null);
                setFormData({ title: '', description: '', content: '' });
                setSelectedPolicyType('');
              }}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Policy
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-slate-800 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-slate-200">
                {editingPolicy ? 'Edit Policy' : 'Create New Policy'}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {editingPolicy ? 'Update the policy details below' : 'Create a new policy by filling in the form'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label className="text-slate-300">Policy Type</Label>
                <Select value={selectedPolicyType} onValueChange={setSelectedPolicyType} disabled={!!editingPolicy}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                    <SelectValue placeholder="Select policy type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-700 border-slate-600">
                    {policyTypesList.map((type) => (
                      <SelectItem key={type.value} value={type.value} className="text-slate-200 focus:bg-slate-600">
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-slate-300">Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Policy title"
                  className="bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500"
                />
              </div>

              <div>
                <Label className="text-slate-300">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description"
                  className="bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500 min-h-20"
                />
              </div>

              <div>
                <Label className="text-slate-300">Content (HTML supported)</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Policy content in HTML format"
                  className="bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500 min-h-32 font-mono text-sm"
                />
              </div>

              {selectedPolicyType === 'return' && (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-slate-300 text-sm">Return Days</Label>
                      <Input
                        type="number"
                        value={formData.metadata?.returnDays || 14}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            metadata: { ...formData.metadata, returnDays: parseInt(e.target.value) },
                          })
                        }
                        className="bg-slate-700 border-slate-600 text-slate-200"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 text-sm">Restocking Fee %</Label>
                      <Input
                        type="number"
                        value={formData.metadata?.restockingFeePercentage || 0}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            metadata: {
                              ...formData.metadata,
                              restockingFeePercentage: parseFloat(e.target.value),
                            },
                          })
                        }
                        className="bg-slate-700 border-slate-600 text-slate-200"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300 text-sm">Extended Defects</Label>
                      <Input
                        type="number"
                        value={formData.metadata?.extendedForDefects || 30}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            metadata: {
                              ...formData.metadata,
                              extendedForDefects: parseInt(e.target.value),
                            },
                          })
                        }
                        className="bg-slate-700 border-slate-600 text-slate-200"
                      />
                    </div>
                  </div>
                </>
              )}

              {selectedPolicyType === 'shipping' && (
                <div>
                  <Label className="text-slate-300">Free Shipping Threshold (LKR)</Label>
                  <Input
                    type="number"
                    value={formData.metadata?.freeShippingThreshold || 5000}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        metadata: {
                          ...formData.metadata,
                          freeShippingThreshold: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="bg-slate-700 border-slate-600 text-slate-200"
                  />
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  onClick={() => setShowDialog(false)}
                  variant="outline"
                  className="border-slate-600 text-slate-300"
                >
                  Cancel
                </Button>
                <Button onClick={handleSavePolicy} className="bg-amber-500 hover:bg-amber-600 text-slate-900">
                  {editingPolicy ? 'Update Policy' : 'Create Policy'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      ) : policies.length === 0 ? (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-slate-500 mb-4" />
            <p className="text-slate-400">No policies created yet. Create your first policy to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {policies.map((policy) => (
            <motion.div
              key={policy._id || policy.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border-slate-700 bg-slate-800/50 hover:bg-slate-800/70 transition">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-slate-200">{policy.title}</CardTitle>
                      <p className="text-sm text-slate-400 mt-1">{PolicyTypeLabels[policy.policyType]}</p>
                    </div>
                    <Badge className={policy.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}>
                      {policy.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-slate-400 line-clamp-2">{policy.description}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>v{policy.version}</span>
                    {policy.createdAt && (
                      <span>
                        • {new Date(policy.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2 pt-3">
                    <Button
                      onClick={() => handleEditPolicy(policy.policyType)}
                      size="sm"
                      variant="outline"
                      className="border-slate-600 text-slate-300 hover:bg-slate-700 flex-1"
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleViewVersions(policy.policyType)}
                      size="sm"
                      variant="outline"
                      className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    {policy.isActive && (
                      <Button
                        onClick={() => handleDeactivatePolicy(policy.policyType)}
                        size="sm"
                        variant="outline"
                        className="border-red-600/50 text-red-400 hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Version History Dialog */}
      <Dialog open={!!viewingPolicy} onOpenChange={() => setViewingPolicy(null)}>
        <DialogContent className="max-w-2xl bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-slate-200">Version History - {viewingPolicy?.title}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {versions.map((version, index) => (
              <Card key={index} className="border-slate-700 bg-slate-700/50">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-slate-200">Version {version.version}</p>
                      {version.createdAt && (
                        <p className="text-xs text-slate-400">
                          {new Date(version.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                    {version.isActive && <Badge className="bg-green-500/20 text-green-400">Current</Badge>}
                  </div>
                  <p className="text-sm text-slate-300">{version.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PolicyManager;
