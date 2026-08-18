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

const orderStatuses: { value: string; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'pending', label: 'Pending', icon: Package, color: 'bg-warning/20 text-warning border-warning/30' },
  { value: 'confirmed', label: 'Accepted', icon: CheckCircle, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { value: 'processing', label: 'Packed', icon: Package, color: 'bg-primary/20 text-primary border-primary/30' },
  { value: 'ready_to_ship', label: 'Ready to Ship', icon: Package, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'shipped', label: 'Shipped', icon: Truck, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { value: 'out_for_delivery', label: 'Out for Delivery', icon: Truck, color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle, color: 'bg-success/20 text-success border-success/30' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'bg-destructive/20 text-destructive border-destructive/30' },
  { value: 'return_requested', label: 'Return Requested', icon: XCircle, color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  { value: 'returned', label: 'Returned', icon: XCircle, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
  { value: 'refunded', label: 'Refunded', icon: XCircle, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
];

// Valid status transitions matching backend validTransitions
const validStatusTransitions: Record<string, string[]> = {
  'pending': ['confirmed', 'cancelled'],
  'confirmed': ['processing', 'cancelled'],
  'processing': ['ready_to_ship', 'cancelled'],
  'ready_to_ship': ['shipped'],
  'shipped': ['out_for_delivery', 'delivered', 'return_requested'],
  'out_for_delivery': ['delivered', 'return_requested'],
  'delivered': ['return_requested'],
  'return_requested': ['returned', 'cancelled'],
  'returned': ['refunded']
};

const getValidNextStatuses = (currentStatus: string): string[] => {
  return validStatusTransitions[currentStatus] || [];
};

const AdminOrders: React.FC = () => {
  const { shop, user } = useAuth();
  const vendorId = shop?.id || user?.id;
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

  useEffect(() => { if (vendorId) fetchOrders(); }, [vendorId]);

  const formatShippingAddress = (
    shippingAddress: unknown,
    shippingCity?: string,
    shippingPostalCode?: string
  ) => {
    if (typeof shippingAddress === 'string') {
      return [shippingAddress, shippingCity, shippingPostalCode]
        .filter(Boolean)
        .join(', ');
    }

    if (!shippingAddress || typeof shippingAddress !== 'object') {
      return [shippingCity, shippingPostalCode].filter(Boolean).join(', ');
    }

    const address = shippingAddress as Record<string, unknown>;
    const getString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

    return [
      getString(address.addressLine1),
      getString(address.addressLine2),
      getString(address.city) || shippingCity,
      getString(address.postalCode) || shippingPostalCode,
      getString(address.country),
    ]
      .filter(Boolean)
      .join(', ');
  };

  const getDisplayStatus = (order?: ApiOrder | null) => {
    if (!order) return 'pending';
    if (order.items && order.items.length > 0) {
      return order.items[0].status || order.overallStatus || order.status || 'pending';
    }
    return order.overallStatus || order.status || 'pending';
  };

  const fetchOrders = async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const response = await api.getVendorOrders();
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
      const orderData = await api.getOrder(String(order.id || order._id || ''));
      setOrderItems(orderData.items || []);
      // Customer info would come from the order response if available
    } catch (error) {
      console.error('Error fetching order details:', error);
    }
    setLoadingDetails(false);
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    setUpdatingStatus(orderId);
    try {
      const orderToUpdate = orders.find((order) => String(order.id || order._id) === String(orderId));
      const itemIds = (orderToUpdate?.items || [])
        .map((item) => item.id || item._id)
        .filter(Boolean);

      if (itemIds.length === 0) {
        throw new Error('No items found to update for this order.');
      }

      await Promise.all(
        itemIds.map((itemId) => api.updateOrderItemStatus(String(orderId), String(itemId), status))
      );

      setOrders(orders.map(o => {
        if (String(o.id || o._id) !== String(orderId)) return o;
        const updatedItems = (o.items || []).map(item => ({
          ...item,
          status
        }));
        return { ...o, items: updatedItems };
      }));

      if (selectedOrder && String(selectedOrder.id || selectedOrder._id) === String(orderId)) {
        const updatedItems = (selectedOrder.items || []).map(item => ({
          ...item,
          status
        }));
        setSelectedOrder({ ...selectedOrder, items: updatedItems });
      }
      toast({ title: 'Updated', description: `Order marked as ${status}` });
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update order', variant: 'destructive' });
    }
    setUpdatingStatus(null);
  };

  const updateOrderDetails = async () => {
    if (!selectedOrder) return;
    try {
      const selectedOrderId = String(selectedOrder.id || selectedOrder._id || '');
      await api.updateOrderTracking(selectedOrderId, trackingNumber);
      setOrders(orders.map(o => String(o.id || o._id) === selectedOrderId ? { ...o, trackingNumber: trackingNumber || undefined } : o));
      toast({ title: 'Saved', description: 'Order details updated' });
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update order', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = orderStatuses.find(s => s.value === status) || orderStatuses[0];
    return <Badge variant="outline" className={statusInfo.color}>{statusInfo.label}</Badge>;
  };

  const filteredOrders = orders.filter(Boolean).filter(order => {
    const normalizedQuery = searchQuery.toLowerCase();
    const matchesSearch =
      String(order.id || order._id || order.orderNumber || '').toLowerCase().includes(normalizedQuery) ||
      String(order.shippingAddress || '').toLowerCase().includes(normalizedQuery) ||
      String(order.trackingNumber || '').toLowerCase().includes(normalizedQuery);
    const matchesStatus = statusFilter === 'all' || getDisplayStatus(order) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => getDisplayStatus(o) === 'pending').length,
    processing: orders.filter(o => getDisplayStatus(o) === 'processing').length,
    shipped: orders.filter(o => getDisplayStatus(o) === 'shipped').length,
    delivered: orders.filter(o => getDisplayStatus(o) === 'delivered').length,
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
                filteredOrders.map((order, index) => {
                  const orderKey = String(order.id || order._id || order.orderNumber || `order-${index}`);
                    const orderId = String(order.id || order._id || '');
                  const shippingSummary = formatShippingAddress(
                    order.shippingAddress,
                    order.shippingCity,
                    order.shippingPostalCode
                  );

                  return (
                  <TableRow key={orderKey} className="border-border/50">
                    <TableCell className="font-mono text-sm">#{String(order.id || order._id || order.orderNumber || '').slice(0, 8)}</TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell"><div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(order.createdAt).toLocaleDateString()}</div></TableCell>
                    <TableCell className="hidden md:table-cell"><div className="flex items-start gap-1 max-w-xs"><MapPin className="h-3 w-3 mt-1 flex-shrink-0 text-muted-foreground" /><span className="text-sm line-clamp-2">{shippingSummary || 'Shipping address unavailable'}</span></div></TableCell>
                    <TableCell className="text-right"><div><p className="font-medium">{formatLKR(order.totalAmount)}</p>{order.commissionAmount && <p className="text-xs text-muted-foreground">Commission: {formatLKR(order.commissionAmount)}</p>}</div></TableCell>
                    <TableCell className="text-center">{getStatusBadge(getDisplayStatus(order))}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={updatingStatus === orderId}>{updatingStatus === orderId ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}</Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="glass-card">
                          <DropdownMenuItem onClick={() => openOrderDetails(order)}><Eye className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {orderStatuses.filter(s => getValidNextStatuses(getDisplayStatus(order)).includes(s.value)).map(status => (
                            <DropdownMenuItem key={status.value} onClick={() => updateOrderStatus(orderId, status.value)}><status.icon className="h-4 w-4 mr-2" />Mark as {status.label}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )})
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="glass-card max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">Order #{String(selectedOrder?.id || selectedOrder?._id || selectedOrder?.orderNumber || '').slice(0, 8)} {selectedOrder && getStatusBadge(getDisplayStatus(selectedOrder))}</DialogTitle>
            <DialogDescription>Placed on {selectedOrder && new Date(selectedOrder.createdAt).toLocaleString()}</DialogDescription>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-6 py-4">
              <div className="glass-card p-4 bg-secondary/30">
                <h4 className="font-semibold mb-2 flex items-center gap-2"><MapPin className="h-4 w-4" /> Shipping Address</h4>
                <p className="text-sm">{formatShippingAddress(selectedOrder?.shippingAddress, selectedOrder?.shippingCity, selectedOrder?.shippingPostalCode) || 'Shipping address unavailable'}</p>
              </div>
              <div>
                <h4 className="font-semibold mb-3">Order Items</h4>
                <div className="space-y-2">
                  {orderItems.map(item => (
                    <div key={String(item.id || item._id || `${item.productId}-${item.quantity}`)} className="flex items-center justify-between glass-card p-3 bg-secondary/30">
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
                  {orderStatuses.filter(s => getValidNextStatuses(getDisplayStatus(selectedOrder!)).includes(s.value)).map(status => (
                    <Button key={status.value} variant={getDisplayStatus(selectedOrder!) === status.value ? 'default' : 'outline'} size="sm" onClick={() => updateOrderStatus(String(selectedOrder!.id || selectedOrder!._id || ''), status.value)} disabled={getDisplayStatus(selectedOrder!) === status.value}>
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
