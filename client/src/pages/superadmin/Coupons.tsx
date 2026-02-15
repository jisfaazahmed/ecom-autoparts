import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Ticket, Plus, Search, MoreVertical, Edit, Trash2, 
  Loader2, Percent, Copy, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatLKR } from '@/lib/currency';
import { format } from 'date-fns';

interface Coupon {
  id: string;
  code: string;
  description?: string | null;
  discountType: string;
  discountValue: number;
  minimumOrderAmount?: number | null;
  maxUses?: number | null;
  usedCount: number;
  validFrom: string;
  validUntil?: string | null;
  isActive: boolean;
  shopId?: string | null;
}

const emptyCoupon = {
  code: '',
  description: '',
  discountType: 'percentage',
  discountValue: '',
  minimumOrderAmount: '',
  maxUses: '',
  validFrom: new Date().toISOString().split('T')[0],
  validUntil: '',
};

const SuperAdminCoupons: React.FC = () => {
  const { toast } = useToast();
  
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState(emptyCoupon);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const data = await api.getCoupons();
      // Filter to only platform-wide coupons (no shopId)
      setCoupons(data.data.filter((c: Coupon) => !c.shopId));
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const openAddDialog = () => {
    setEditingCoupon(null);
    setFormData(emptyCoupon);
    setDialogOpen(true);
  };

  const openEditDialog = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue.toString(),
      minimumOrderAmount: coupon.minimumOrderAmount?.toString() || '',
      maxUses: coupon.maxUses?.toString() || '',
      validFrom: coupon.validFrom.split('T')[0],
      validUntil: coupon.validUntil?.split('T')[0] || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.discountValue) {
      toast({ title: 'Error', description: 'Code and discount value are required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const couponData = {
      code: formData.code.toUpperCase(),
      description: formData.description || null,
      discountType: formData.discountType as 'percentage' | 'fixed',
      discountValue: parseFloat(formData.discountValue),
      minimumOrderAmount: formData.minimumOrderAmount ? parseFloat(formData.minimumOrderAmount) : 0,
      maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
      validFrom: new Date(formData.validFrom).toISOString(),
      validUntil: formData.validUntil ? new Date(formData.validUntil).toISOString() : null,
      shopId: null,
    };

    try {
      if (editingCoupon) {
        await api.updateCoupon(editingCoupon.id, couponData);
        toast({ title: 'Updated', description: 'Coupon updated successfully' });
      } else {
        await api.createCoupon({ ...couponData, isActive: true });
        toast({ title: 'Created', description: 'Coupon created successfully' });
      }
      setDialogOpen(false);
      fetchCoupons();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!couponToDelete) return;
    setSaving(true);
    try {
      await api.deleteCoupon(couponToDelete.id);
      toast({ title: 'Deleted', description: 'Coupon has been deleted' });
      setDeleteDialogOpen(false);
      setCouponToDelete(null);
      fetchCoupons();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      await api.updateCoupon(coupon.id, { isActive: !coupon.isActive });
      setCoupons(coupons.map(c => c.id === coupon.id ? { ...c, isActive: !c.isActive } : c));
      toast({ title: coupon.isActive ? 'Deactivated' : 'Activated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredCoupons = coupons.filter(c => 
    c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isExpired = (coupon: Coupon) => coupon.validUntil && new Date(coupon.validUntil) < new Date();
  const isMaxedOut = (coupon: Coupon) => coupon.maxUses && coupon.usedCount >= coupon.maxUses;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-3">
              <Ticket className="h-7 w-7 lg:h-8 lg:w-8 text-primary" />
              Coupons
            </h1>
            <p className="text-muted-foreground mt-1">Manage platform-wide discount coupons</p>
          </div>
          <Button onClick={openAddDialog} className="neon-button">
            <Plus className="h-4 w-4 mr-2" />Add Coupon
          </Button>
        </div>

        <div className="glass-card p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search coupons..." 
              className="pl-10 bg-secondary/50" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
          </div>
        </div>

        <div className="glass-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead>Code</TableHead>
                <TableHead className="hidden md:table-cell">Discount</TableHead>
                <TableHead className="hidden lg:table-cell">Min. Order</TableHead>
                <TableHead className="hidden md:table-cell">Usage</TableHead>
                <TableHead className="hidden lg:table-cell">Valid Until</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCoupons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No coupons found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCoupons.map((coupon) => (
                  <TableRow key={coupon.id} className="border-border/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="bg-primary/10 text-primary px-2 py-1 rounded font-mono text-sm">
                          {coupon.code}
                        </code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(coupon.code)}>
                          {copiedCode === coupon.code ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                      {coupon.description && <p className="text-xs text-muted-foreground mt-1">{coupon.description}</p>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        {coupon.discountType === 'percentage' ? (
                          <><Percent className="h-4 w-4 text-primary" />{coupon.discountValue}%</>
                        ) : (
                          <>{formatLKR(coupon.discountValue)}</>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {coupon.minimumOrderAmount > 0 ? formatLKR(coupon.minimumOrderAmount) : '-'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className={isMaxedOut(coupon) ? 'text-destructive' : ''}>
                        {coupon.usedCount}{coupon.maxUses ? `/${coupon.maxUses}` : ''}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {coupon.validUntil ? (
                        <span className={isExpired(coupon) ? 'text-destructive' : ''}>
                          {format(new Date(coupon.validUntil), 'PP')}
                        </span>
                      ) : 'No expiry'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={isExpired(coupon) || isMaxedOut(coupon) ? 'destructive' : coupon.isActive ? 'default' : 'secondary'}>
                        {isExpired(coupon) ? 'Expired' : isMaxedOut(coupon) ? 'Maxed' : coupon.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass-card">
                          <DropdownMenuItem onClick={() => openEditDialog(coupon)}>
                            <Edit className="h-4 w-4 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleActive(coupon)}>
                            <Switch checked={coupon.isActive} className="mr-2 scale-75" />
                            {coupon.isActive ? 'Deactivate' : 'Activate'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive" 
                            onClick={() => { setCouponToDelete(coupon); setDeleteDialogOpen(true); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="glass-card max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCoupon ? 'Edit Coupon' : 'Create Coupon'}</DialogTitle>
            <DialogDescription>
              {editingCoupon ? 'Update the coupon details' : 'Create a new platform-wide discount coupon'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Coupon Code *</Label>
              <Input 
                value={formData.code} 
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} 
                placeholder="e.g., SAVE20" 
                className="font-mono"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea 
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                placeholder="e.g., 20% off on all orders"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Discount Type</Label>
                <Select 
                  value={formData.discountType} 
                  onValueChange={(v) => setFormData({ ...formData, discountType: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="glass-card">
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount (LKR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Discount Value *</Label>
                <Input 
                  type="number" 
                  value={formData.discountValue} 
                  onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })} 
                  placeholder={formData.discountType === 'percentage' ? '20' : '1000'}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Min. Order Amount</Label>
                <Input 
                  type="number" 
                  value={formData.minimumOrderAmount} 
                  onChange={(e) => setFormData({ ...formData, minimumOrderAmount: e.target.value })} 
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Max Uses</Label>
                <Input 
                  type="number" 
                  value={formData.maxUses} 
                  onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })} 
                  placeholder="Unlimited"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valid From</Label>
                <Input 
                  type="date" 
                  value={formData.validFrom} 
                  onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })} 
                />
              </div>
              <div>
                <Label>Valid Until</Label>
                <Input 
                  type="date" 
                  value={formData.validUntil} 
                  onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })} 
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCoupon ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>Delete Coupon</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the coupon "{couponToDelete?.code}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default SuperAdminCoupons;
