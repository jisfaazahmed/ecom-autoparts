import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, ShoppingBag, DollarSign, TrendingUp, Plus, Search, MoreVertical, Eye, Loader2, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiProduct, ApiOrder, ApiCategory, ApiVehicleVariant } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatLKR } from '@/lib/currency';

const AdminDashboard: React.FC = () => {
  const { profile, shop, role } = useAuth();
  const { toast } = useToast();
  
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [variants, setVariants] = useState<ApiVehicleVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', stock: '', sku: '', category_id: '', compatible_variants: [] as string[] });

  useEffect(() => { if (shop?.id) fetchData(); }, [shop?.id]);

  const fetchData = async () => {
    if (!shop?.id) return;
    setLoading(true);
    try {
      const [productsRes, ordersRes, categoriesRes, refundsRes] = await Promise.all([
        api.getProducts({ shop: shop.id }),
        api.getVendorOrders({ limit: 10 }),
        api.getCategories(),
        role === 'admin' || role === 'superadmin' 
          ? api.getAdminRefunds({ limit: 200 }) 
          : api.getVendorRefunds({ limit: 200 }),
      ]);
      setProducts(productsRes.data || []);
      setOrders(ordersRes.data || []);
      setCategories(categoriesRes || []);
      setRefunds(refundsRes.refunds || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
    setLoading(false);
  };

  const handleAddProduct = async () => {
    if (!shop?.id || !newProduct.name || !newProduct.price) {
      toast({ title: 'Error', description: 'Please fill in required fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await api.createProduct({
        name: newProduct.name,
        description: newProduct.description || undefined,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock) || 0,
        sku: newProduct.sku || undefined,
        shopId: shop.id,
        isActive: true,
        categoryId: newProduct.category_id || undefined,
        compatibleVariants: newProduct.compatible_variants.length > 0 ? newProduct.compatible_variants : undefined,
      } as any);
      toast({ title: 'Success', description: 'Product added successfully' });
      setAddProductOpen(false);
      setNewProduct({ name: '', description: '', price: '', stock: '', sku: '', category_id: '', compatible_variants: [] });
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to add product', variant: 'destructive' });
    }
    setSaving(false);
  };

  const toggleVariant = (variantId: string) => {
    setNewProduct(prev => ({ ...prev, compatible_variants: prev.compatible_variants.includes(variantId) ? prev.compatible_variants.filter(v => v !== variantId) : [...prev.compatible_variants, variantId] }));
  };

  const updateOrderStatus = async (orderId: string, status: ApiOrder['status']) => {
    try {
      await api.updateOrderStatus(orderId, status);
      setOrders(orders.map(o => o.id === orderId ? { ...o, status } : o));
      toast({ title: 'Order Updated', description: `Order marked as ${status}` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update order', variant: 'destructive' });
    }
  };

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const avgOrderValue = orders.length ? totalRevenue / orders.length : 0;
  const pendingRefunds = refunds.filter((refund) => String(refund.status || '').toLowerCase() === 'requested').length;
  const processingReturns = refunds.filter((refund) => {
    const returnStatus = String(refund.returnStatus || '').toLowerCase();
    return ['pending', 'picked'].includes(returnStatus) && String(refund.status || '').toLowerCase() === 'approved';
  }).length;

  const stats = [
    { label: 'Total Products', value: products.length, icon: Package, change: '+12%' },
    { label: 'Total Orders', value: orders.length, icon: ShoppingBag, change: '+8%' },
    { label: 'Revenue', value: formatLKR(totalRevenue), icon: DollarSign, change: '+23%' },
    { label: 'Avg Order Value', value: formatLKR(avgOrderValue), icon: TrendingUp, change: '+5%' },
    { label: 'Pending Refund Reviews', value: pendingRefunds, icon: AlertCircle, change: pendingRefunds > 0 ? 'Needs action' : 'Clear' },
    { label: 'Returns In Progress', value: processingReturns, icon: RotateCcw, change: processingReturns > 0 ? 'Active' : 'Idle' },
  ];

  const parentCategories = categories.filter(c => !c.parentId);
  const getSubcategories = (parentId: string) => categories.filter(c => c.parentId === parentId);

  const getStatusBadge = (status: string | undefined | null) => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    const styles: Record<string, string> = { pending: 'bg-warning/20 text-warning border-warning/30', processing: 'bg-primary/20 text-primary border-primary/30', shipped: 'bg-purple-500/20 text-purple-400 border-purple-500/30', delivered: 'bg-success/20 text-success border-success/30', cancelled: 'bg-destructive/20 text-destructive border-destructive/30' };
    return <Badge variant="outline" className={styles[status] || ''}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {profile?.full_name}</p>
          </div>
          <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
            <DialogTrigger asChild>
              <Button className="neon-button">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add New Product</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Name *</Label><Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Price *</Label><Input type="number" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} /></div>
                  <div><Label>Stock</Label><Input type="number" value={newProduct.stock} onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })} /></div>
                </div>
                <div><Label>SKU</Label><Input value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} /></div>
                <div>
                  <Label>Category</Label>
                  <Select value={newProduct.category_id} onValueChange={(v) => setNewProduct({ ...newProduct, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent className="glass-card">
                      {parentCategories.map(parent => (
                        <React.Fragment key={parent.id}>
                          <SelectItem value={parent.id} className="font-semibold">{parent.name}</SelectItem>
                          {getSubcategories(parent.id).map(sub => <SelectItem key={sub.id} value={sub.id} className="pl-6">↳ {sub.name}</SelectItem>)}
                        </React.Fragment>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Compatible Vehicles ({newProduct.compatible_variants.length} selected)</Label>
                  <ScrollArea className="h-48 border rounded-lg p-2 mt-2">
                    {variants.map(v => (
                      <div key={v.id} className="flex items-center space-x-2 py-1">
                        <Checkbox id={v.id} checked={newProduct.compatible_variants.includes(v.id)} onCheckedChange={() => toggleVariant(v.id)} />
                        <label htmlFor={v.id} className="text-sm cursor-pointer">{v.name} ({v.yearStart}-{v.yearEnd || 'Present'})</label>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
                <Button onClick={handleAddProduct} disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Product'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 lg:p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <stat.icon className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                </div>
                <Badge variant="outline" className="text-success border-success/30 text-xs">{stat.change}</Badge>
              </div>
              <p className="text-xl lg:text-2xl font-display font-bold">{stat.value}</p>
              <p className="text-xs lg:text-sm text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="glass-card p-4 lg:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h2 className="font-display text-xl font-bold">Recent Orders</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search orders..." className="pl-10 w-full sm:w-64 bg-secondary/50" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Order ID</TableHead>
                  <TableHead className="hidden sm:table-cell">Customer</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Delivery Address</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const address = order.shippingAddress;
                  const addressStr = typeof address === 'string' 
                    ? address 
                    : (address && typeof address === 'object' && 'addressLine1' in address 
                      ? address.addressLine1 
                      : 'N/A');
                  const addressDisplay = addressStr.length > 25 ? addressStr.substring(0, 22) + '...' : addressStr;
                  return (
                    <TableRow key={order.id} className="border-border/50">
                      <TableCell className="font-mono text-sm">#{order.id.slice(0, 8)}</TableCell>
                      <TableCell className="hidden sm:table-cell">Customer</TableCell>
                      <TableCell className="font-medium">{formatLKR(order.totalAmount)}</TableCell>
                      <TableCell>{getStatusBadge(order.status)}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground" title={addressStr}>{addressDisplay}</TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="glass-card">
                            <DropdownMenuItem><Eye className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateOrderStatus(order.id, 'processing')}>Mark as Processing</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateOrderStatus(order.id, 'shipped')}>Mark as Shipped</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateOrderStatus(order.id, 'delivered')}>Mark as Delivered</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </motion.div>
    </AdminLayout>
  );
};

export default AdminDashboard;