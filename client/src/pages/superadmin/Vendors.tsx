import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, Search, CheckCircle, XCircle, Clock, Loader2, Mail, Phone, Eye, Filter, Percent, MoreVertical, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent } from '@/components/ui/card';
import AdminLayout from '@/components/layout/AdminLayout';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Shop {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  status: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  businessRegistration: string | null;
  logoUrl: string | null;
  commissionRate: number | null;
  rejectionReason: string | null;
  createdAt: string;
}

interface OwnerProfile {
  fullName: string;
  email: string;
  phone: string | null;
}

const SuperAdminVendors: React.FC = () => {
  const { toast } = useToast();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [ownerInfo, setOwnerInfo] = useState<OwnerProfile | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [commissionDialogOpen, setCommissionDialogOpen] = useState(false);
  const [newCommissionRate, setNewCommissionRate] = useState(10);
  const [updatingCommission, setUpdatingCommission] = useState(false);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargetShop, setRejectTargetShop] = useState<Shop | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [updatingReject, setUpdatingReject] = useState(false);

  useEffect(() => { fetchShops(); }, []);

  const fetchShops = async () => {
    setLoading(true);
    try {
      const data = await api.getAllShops();
      setShops(data.data as Shop[]);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const openShopDetails = async (shop: Shop) => {
    setSelectedShop(shop);
    setNewCommissionRate(shop.commissionRate || 10);
    setDetailsDialogOpen(true);
    setLoadingDetails(true);
    try {
      const profile = await api.getShopOwnerProfile(shop.ownerId);
      if (profile) setOwnerInfo({ fullName: profile.full_name, email: profile.email, phone: profile.phone || null });
    } catch (error) {
      console.error('Failed to load owner profile:', error);
    }
    setLoadingDetails(false);
  };

  const updateShopStatus = async (shopId: string, status: 'approved' | 'rejected' | 'pending', reason?: string) => {
    try {
      await api.updateShopStatus(shopId, status, reason);
      const updated = { status, ...(status === 'rejected' && reason ? { rejectionReason: reason } : { rejectionReason: null }) };
      setShops(shops.map(s => s.id === shopId ? { ...s, ...updated } : s));
      if (selectedShop?.id === shopId) setSelectedShop({ ...selectedShop, ...updated });
      toast({ title: 'Updated', description: `Shop status changed to ${status}` });
      setRejectDialogOpen(false);
      setRejectTargetShop(null);
      setRejectReason('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const openRejectDialog = (shop: Shop) => {
    setRejectTargetShop(shop);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!rejectTargetShop) return;
    setUpdatingReject(true);
    try {
      await updateShopStatus(rejectTargetShop.id, 'rejected', rejectReason.trim() || undefined);
    } finally {
      setUpdatingReject(false);
    }
  };

  const updateCommissionRate = async () => {
    if (!selectedShop) return;
    setUpdatingCommission(true);
    try {
      await api.updateShopCommission(selectedShop.id, newCommissionRate);
      setShops(shops.map(s => s.id === selectedShop.id ? { ...s, commissionRate: newCommissionRate } : s));
      setSelectedShop({ ...selectedShop, commissionRate: newCommissionRate });
      toast({ title: 'Updated', description: `Commission rate set to ${newCommissionRate}%` });
      setCommissionDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setUpdatingCommission(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-success/20 text-success border-success/30"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'pending': return <Badge className="bg-warning/20 text-warning border-warning/30"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'rejected': return <Badge className="bg-destructive/20 text-destructive border-destructive/30"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default: return null;
    }
  };

  const filteredShops = shops.filter(shop => {
    const matchesSearch = shop.name.toLowerCase().includes(searchQuery.toLowerCase()) || (shop.email && shop.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || shop.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = { total: shops.length, pending: shops.filter(s => s.status === 'pending').length, approved: shops.filter(s => s.status === 'approved').length, rejected: shops.filter(s => s.status === 'rejected').length };

  if (loading) {
    return <AdminLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AdminLayout>;
  }

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-3"><Building2 className="h-7 w-7 lg:h-8 lg:w-8 text-primary" />Vendor Management</h1>
          <p className="text-muted-foreground mt-1">Manage seller registrations and shop approvals</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4 mb-6">
          <Card className="glass-card"><CardContent className="p-3 lg:p-4 text-center"><p className="text-xl lg:text-2xl font-display font-bold">{stats.total}</p><p className="text-xs lg:text-sm text-muted-foreground">Total Vendors</p></CardContent></Card>
          <Card className="glass-card border-warning/30"><CardContent className="p-3 lg:p-4 text-center"><p className="text-xl lg:text-2xl font-display font-bold text-warning">{stats.pending}</p><p className="text-xs lg:text-sm text-muted-foreground">Pending</p></CardContent></Card>
          <Card className="glass-card border-success/30"><CardContent className="p-3 lg:p-4 text-center"><p className="text-xl lg:text-2xl font-display font-bold text-success">{stats.approved}</p><p className="text-xs lg:text-sm text-muted-foreground">Approved</p></CardContent></Card>
          <Card className="glass-card border-destructive/30"><CardContent className="p-3 lg:p-4 text-center"><p className="text-xl lg:text-2xl font-display font-bold text-destructive">{stats.rejected}</p><p className="text-xs lg:text-sm text-muted-foreground">Rejected</p></CardContent></Card>
        </div>

        <div className="glass-card p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by shop name or email..." className="pl-10 bg-secondary/50" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-40 bg-secondary/50"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger><SelectContent className="glass-card"><SelectItem value="all">All Vendors</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="approved">Approved</SelectItem><SelectItem value="rejected">Rejected</SelectItem></SelectContent></Select>
          </div>
        </div>

        <div className="glass-card overflow-x-auto">
          <Table>
            <TableHeader><TableRow className="border-border/50"><TableHead>Shop</TableHead><TableHead className="hidden md:table-cell">Contact</TableHead><TableHead>Status</TableHead><TableHead className="text-center hidden sm:table-cell">Commission</TableHead><TableHead className="hidden lg:table-cell">Joined</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {filteredShops.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No vendors found</TableCell></TableRow>
              ) : (
                filteredShops.map((shop) => (
                  <TableRow key={shop.id} className="border-border/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center overflow-hidden flex-shrink-0">{shop.logoUrl ? <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover" /> : <Building2 className="h-5 w-5 text-muted-foreground" />}</div>
                        <div className="min-w-0"><p className="font-medium truncate">{shop.name}</p>{shop.description && <p className="text-xs text-muted-foreground line-clamp-1 hidden sm:block">{shop.description}</p>}</div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm space-y-1">{shop.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" />{shop.email}</div>}{shop.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{shop.phone}</div>}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(shop.status)}</TableCell>
                    <TableCell className="text-center hidden sm:table-cell"><Badge variant="outline" className="font-mono">{shop.commissionRate || 10}%</Badge></TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">{new Date(shop.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass-card">
                          <DropdownMenuItem onClick={() => openShopDetails(shop)}><Eye className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {shop.status !== 'approved' && <DropdownMenuItem onClick={() => updateShopStatus(shop.id, 'approved')}><CheckCircle className="h-4 w-4 mr-2 text-success" />Approve</DropdownMenuItem>}
                          {shop.status !== 'rejected' && <DropdownMenuItem onClick={() => openRejectDialog(shop)}><XCircle className="h-4 w-4 mr-2 text-destructive" />Reject</DropdownMenuItem>}
                          {shop.status !== 'pending' && <DropdownMenuItem onClick={() => updateShopStatus(shop.id, 'pending')}><Clock className="h-4 w-4 mr-2 text-warning" />Set Pending</DropdownMenuItem>}
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

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="glass-card max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-secondary/50 flex items-center justify-center overflow-hidden">{selectedShop?.logoUrl ? <img src={selectedShop.logoUrl} alt={selectedShop.name} className="w-full h-full object-cover" /> : <Building2 className="h-6 w-6 text-muted-foreground" />}</div>
              <div><span>{selectedShop?.name}</span><div className="mt-1">{selectedShop && getStatusBadge(selectedShop.status)}</div></div>
            </DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-6 py-4">
              {ownerInfo && (
                <div className="glass-card p-4 bg-secondary/30">
                  <h4 className="font-semibold mb-2">Shop Owner</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> {ownerInfo.fullName}</div>
                    <div><span className="text-muted-foreground">Email:</span> {ownerInfo.email}</div>
                    {ownerInfo.phone && <div><span className="text-muted-foreground">Phone:</span> {ownerInfo.phone}</div>}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><Label className="text-muted-foreground">Description</Label><p className="text-sm mt-1">{selectedShop?.description || 'No description'}</p></div>
                <div><Label className="text-muted-foreground">Business Registration</Label><p className="text-sm mt-1 font-mono">{selectedShop?.businessRegistration || 'Not provided'}</p></div>
                <div><Label className="text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />Email</Label><p className="text-sm mt-1">{selectedShop?.email || 'Not provided'}</p></div>
                <div><Label className="text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />Phone</Label><p className="text-sm mt-1">{selectedShop?.phone || 'Not provided'}</p></div>
                <div className="sm:col-span-2"><Label className="text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />Address</Label><p className="text-sm mt-1">{selectedShop?.address || 'Not provided'}</p></div>
              </div>

              <div className="glass-card p-4 bg-secondary/30">
                <div className="flex items-center justify-between">
                  <div><Label>Commission Rate</Label><p className="text-2xl font-display font-bold text-primary">{selectedShop?.commissionRate || 10}%</p></div>
                  <Button variant="outline" onClick={() => setCommissionDialogOpen(true)}><Percent className="h-4 w-4 mr-2" />Change</Button>
                </div>
              </div>

              {selectedShop?.status === 'rejected' && selectedShop?.rejectionReason && (
                <div className="glass-card p-4 bg-destructive/10 border border-destructive/20">
                  <Label className="text-destructive">Rejection reason</Label>
                  <p className="text-sm mt-1">{selectedShop.rejectionReason}</p>
                </div>
              )}

              <div>
                <Label className="mb-2 block">Update Status</Label>
                <div className="flex flex-wrap gap-2">
                  <Button variant={selectedShop?.status === 'approved' ? 'default' : 'outline'} size="sm" onClick={() => updateShopStatus(selectedShop!.id, 'approved')} disabled={selectedShop?.status === 'approved'}><CheckCircle className="h-4 w-4 mr-1" />Approve</Button>
                  <Button variant={selectedShop?.status === 'pending' ? 'default' : 'outline'} size="sm" onClick={() => updateShopStatus(selectedShop!.id, 'pending')} disabled={selectedShop?.status === 'pending'}><Clock className="h-4 w-4 mr-1" />Pending</Button>
                  <Button variant={selectedShop?.status === 'rejected' ? 'default' : 'outline'} size="sm" onClick={() => selectedShop?.status === 'rejected' ? undefined : openRejectDialog(selectedShop!)} disabled={selectedShop?.status === 'rejected'}><XCircle className="h-4 w-4 mr-1" />Reject</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={commissionDialogOpen} onOpenChange={setCommissionDialogOpen}>
        <DialogContent className="glass-card">
          <DialogHeader><DialogTitle>Set Commission Rate</DialogTitle><DialogDescription>Adjust the commission rate for {selectedShop?.name}</DialogDescription></DialogHeader>
          <div className="py-6">
            <div className="flex items-center justify-between mb-4"><Label>Commission Rate</Label><span className="text-2xl font-display font-bold text-primary">{newCommissionRate}%</span></div>
            <Slider value={[newCommissionRate]} onValueChange={(v) => setNewCommissionRate(v[0])} max={30} min={0} step={1} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCommissionDialogOpen(false)}>Cancel</Button><Button onClick={updateCommissionRate} disabled={updatingCommission}>{updatingCommission && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={(open) => { if (!open) { setRejectDialogOpen(false); setRejectTargetShop(null); setRejectReason(''); } }}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>Reject vendor</DialogTitle>
            <DialogDescription>Optionally provide a reason to show the vendor. {rejectTargetShop?.name} will be set to rejected.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-reason">Reason (optional)</Label>
            <Textarea id="reject-reason" className="mt-2 min-h-[80px]" placeholder="e.g. Incomplete documentation" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectTargetShop(null); setRejectReason(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={confirmReject} disabled={updatingReject}>{updatingReject && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default SuperAdminVendors;
