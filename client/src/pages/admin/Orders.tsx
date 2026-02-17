import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, Search, MoreVertical, Eye, Truck, Package, CheckCircle, XCircle, Loader2, Filter, Calendar, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiOrder, ApiOrderItem } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatLKR } from '@/lib/currency';

interface CustomerProfile { full_name: string; email: string; phone: string | null; }

const orderStatuses: { value: ApiOrder['status']; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'pending', label: 'Pending', icon: Package, color: 'bg-warning/20 text-warning border-warning/30' },
  { value: 'processing', label: 'Processing', icon: Package, color: 'bg-primary/20 text-primary border-primary/30' },
  { value: 'shipped', label: 'Shipped', icon: Truck, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'bg-success/20 text-success border-success/30' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'bg-destructive/20 text-destructive border-destructive/30' },
];

const AdminOrders: React.FC = () => {
  const { shop } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null);
  const [orderItems, setOrderItems] = useState<ApiOrderItem[]>([]);
  const [customerInfo, setCustomerInfo] = useState<CustomerProfile | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  useEffect(() => { if (shop?.id) fetchOrders(); }, [shop?.id]);

  const fetchOrders = async () => {
    if (!shop?.id) return;
    setLoading(true);
    try {
      const response = await api.getOrders();
      setOrders(response.data || []);
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to fetch orders', variant: 'destructive' });
    }
    setLoading(false);
  };

  const openOrderDetails = async (order: ApiOrder) => {
    setSelectedOrder(order);
    setTrackingNumber(order.trackingNumber || '');
    setOrderNotes(order.notes || '');
    setDetailsDialogOpen(true);
    setLoadingDetails(true);
    try {
      const orderData = await api.getOrder(order.id);
      setOrderItems(orderData.items || []);
      // Customer info would come from the order response if available
    } catch (error) {
      console.error('Error fetching order details:', error);
    }
    setLoadingDetails(false);
  };

  const updateOrderStatus = async (orderId: string, status: ApiOrder['status']) => {
    setUpdatingStatus(orderId);
    try {
      await api.updateOrderStatus(orderId, status);
      setOrders(orders.map(o => o.id === orderId ? { ...o, status } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder({ ...selectedOrder, status });
      toast({ title: 'Updated', description: `Order marked as ${status}` });
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update order', variant: 'destructive' });
    }
    setUpdatingStatus(null);
  };

  const updateOrderDetails = async () => {
    if (!selectedOrder) return;
    try {
      await api.updateOrderTracking(selectedOrder.id, trackingNumber);
      setOrders(orders.map(o => o.id === selectedOrder.id ? { ...o, trackingNumber: trackingNumber || null } : o));
      toast({ title: 'Saved', description: 'Order details updated' });
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update order', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = orderStatuses.find(s => s.value === status) || orderStatuses[0];
    return <Badge variant="outline" className={statusInfo.color}>{statusInfo.label}</Badge>;
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shippingAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.trackingNumber && order.trackingNumber.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
  };

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
        <div className="mb-8">
          <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <ShoppingBag className="h-7 w-7 lg:h-8 lg:w-8 text-primary" />Orders
          </h1>
          <p className="text-muted-foreground mt-1">Manage and fulfill customer orders</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 lg:gap-4 mb-6">
          <div className="glass-card p-3 lg:p-4 text-center"><p className="text-xl lg:text-2xl font-display font-bold">{stats.total}</p><p className="text-xs lg:text-sm text-muted-foreground">Total</p></div>
          <div className="glass-card p-3 lg:p-4 text-center border-warning/30"><p className="text-xl lg:text-2xl font-display font-bold text-warning">{stats.pending}</p><p className="text-xs lg:text-sm text-muted-foreground">Pending</p></div>
          <div className="glass-card p-3 lg:p-4 text-center border-primary/30"><p className="text-xl lg:text-2xl font-display font-bold text-primary">{stats.processing}</p><p className="text-xs lg:text-sm text-muted-foreground">Processing</p></div>
          <div className="glass-card p-3 lg:p-4 text-center border-purple-500/30"><p className="text-xl lg:text-2xl font-display font-bold text-purple-400">{stats.shipped}</p><p className="text-xs lg:text-sm text-muted-foreground">Shipped</p></div>
          <div className="glass-card p-3 lg:p-4 text-center border-success/30"><p className="text-xl lg:text-2xl font-display font-bold text-success">{stats.delivered}</p><p className="text-xs lg:text-sm text-muted-foreground">Delivered</p></div>
        </div>

        <div className="glass-card p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by order ID, address, or tracking..." className="pl-10 bg-secondary/50" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-secondary/50"><Filter className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent className="glass-card">
                <SelectItem value="all">All Orders</SelectItem>
                {orderStatuses.map(status => <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="glass-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                <TableHead>Order ID</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Shipping Address</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">{searchQuery || statusFilter !== 'all' ? 'No orders match your filters' : 'No orders yet'}</TableCell></TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id} className="border-border/50">
                    <TableCell className="font-mono text-sm">#{order.id.slice(0, 8)}</TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell"><div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(order.createdAt).toLocaleDateString()}</div></TableCell>
                    <TableCell className="hidden md:table-cell"><div className="flex items-start gap-1 max-w-xs"><MapPin className="h-3 w-3 mt-1 flex-shrink-0 text-muted-foreground" /><span className="text-sm line-clamp-2">{order.shippingAddress}{order.shippingCity && `, ${order.shippingCity}`}</span></div></TableCell>
                    <TableCell className="text-right"><div><p className="font-medium">{formatLKR(order.totalAmount)}</p>{order.commissionAmount && <p className="text-xs text-muted-foreground">Commission: {formatLKR(order.commissionAmount)}</p>}</div></TableCell>
                    <TableCell className="text-center">{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={updatingStatus === order.id}>{updatingStatus === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass-card">
                          <DropdownMenuItem onClick={() => openOrderDetails(order)}><Eye className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {orderStatuses.filter(s => s.value !== order.status).map(status => (
                            <DropdownMenuItem key={status.value} onClick={() => updateOrderStatus(order.id, status.value)}><status.icon className="h-4 w-4 mr-2" />Mark as {status.label}</DropdownMenuItem>
                          ))}
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
        <DialogContent className="glass-card max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">Order #{selectedOrder?.id.slice(0, 8)} {selectedOrder && getStatusBadge(selectedOrder.status)}</DialogTitle>
            <DialogDescription>Placed on {selectedOrder && new Date(selectedOrder.createdAt).toLocaleString()}</DialogDescription>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-6 py-4">
              <div className="glass-card p-4 bg-secondary/30">
                <h4 className="font-semibold mb-2 flex items-center gap-2"><MapPin className="h-4 w-4" /> Shipping Address</h4>
                <p className="text-sm">{selectedOrder?.shippingAddress}{selectedOrder?.shippingCity && <><br />{selectedOrder.shippingCity}</>}{selectedOrder?.shippingPostalCode && `, ${selectedOrder.shippingPostalCode}`}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Order Items</h4>
                <div className="space-y-2">
                  {orderItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between glass-card p-3 bg-secondary/30">
                      <div><p className="font-medium">{item.productName}</p><p className="text-sm text-muted-foreground">Qty: {item.quantity} × {formatLKR(item.unitPrice)}</p></div>
                      <p className="font-medium">{formatLKR(item.totalPrice)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-4 pt-4 border-t border-border/50">
                  <span className="font-semibold">Total</span>
                  <span className="font-display text-xl font-bold text-primary">{formatLKR(selectedOrder?.totalAmount || 0)}</span>
                </div>
              </div>
              <div className="space-y-4">
                <div><Label>Tracking Number</Label><Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="Enter tracking number" /></div>
                <Button onClick={updateOrderDetails} className="w-full">Save Details</Button>
              </div>
              <div>
                <Label className="mb-2 block">Update Status</Label>
                <div className="flex flex-wrap gap-2">
                  {orderStatuses.map(status => (
                    <Button key={status.value} variant={selectedOrder?.status === status.value ? 'default' : 'outline'} size="sm" onClick={() => updateOrderStatus(selectedOrder!.id, status.value)} disabled={selectedOrder?.status === status.value}>
                      <status.icon className="h-4 w-4 mr-1" />{status.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminOrders;
