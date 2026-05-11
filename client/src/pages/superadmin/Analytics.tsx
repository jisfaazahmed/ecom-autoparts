import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, DollarSign, TrendingUp, ShoppingBag, Users, Package, Loader2, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout from '@/components/layout/AdminLayout';
import { api, ApiOrder, ApiShop, ApiProduct, ApiCategory } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatLKR, formatLKRCompact } from '@/lib/currency';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';

const SuperAdminAnalytics: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');

  const [totalSales, setTotalSales] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalVendors, setTotalVendors] = useState(0);
  const [growth, setGrowth] = useState({
    sales: 0,
    commission: 0,
    orders: 0,
    vendors: 0,
  });
  const [ordersByStatus, setOrdersByStatus] = useState<{ name: string; value: number; color: string }[]>([]);
  const [salesByMonth, setSalesByMonth] = useState<{ month: string; sales: number; commission: number; orders: number }[]>([]);
  const [topCategories, setTopCategories] = useState<{ name: string; value: number }[]>([]);

  const getRangeStartDate = (range: string) => {
    const now = new Date();
    const start = new Date(now);
    switch (range) {
      case '7d':
        start.setDate(now.getDate() - 7);
        break;
      case '30d':
        start.setDate(now.getDate() - 30);
        break;
      case '90d':
        start.setDate(now.getDate() - 90);
        break;
      case '1y':
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setDate(now.getDate() - 30);
        break;
    }
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const getBucketKey = (date: Date, range: string) => {
    if (range === '1y') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (range === '90d') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return `${weekStart.getFullYear()}-W${String(Math.ceil((((weekStart.getTime() - new Date(weekStart.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7)).padStart(2, '0')}`;
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const getBucketLabel = (key: string, range: string) => {
    if (range === '1y') {
      const [year, month] = key.split('-');
      return new Date(Number(year), Number(month) - 1, 1).toLocaleString('default', { month: 'short' });
    }
    if (range === '90d') return key.replace('-', ' ');
    const [year, month, day] = key.split('-');
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const mapOrderStatusToBucket = (order: ApiOrder) => {
    const raw = String((order as any)?.overallStatus || order.status || 'pending').toLowerCase();
    if (['pending', 'confirmed'].includes(raw)) return 'pending';
    if (['processing', 'accepted', 'packed', 'ready_to_ship', 'out_for_delivery', 'partially_shipped'].includes(raw)) return 'processing';
    if (['shipped'].includes(raw)) return 'shipped';
    if (['delivered', 'partially_delivered'].includes(raw)) return 'delivered';
    if (['cancelled', 'refunded', 'return_requested', 'returned'].includes(raw)) return 'cancelled';
    return 'pending';
  };

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      let ordersData: ApiOrder[] = [];
      let shopsData: ApiShop[] = [];
      let productsData: ApiProduct[] = [];
      let categoriesData: ApiCategory[] = [];

      try {
        const [orders, shops, products, categories] = await Promise.all([
          api.getPlatformOrders({ limit: 500 }).catch(() => ({ data: [] })),
          api.getShops().catch(() => ({ data: [] })),
          api.getSuperAdminProducts({ limit: 500 }).catch(() => ({ data: [] })),
          api.getCategories().catch(() => [])
        ]);

        ordersData = orders?.data || [];
        shopsData = shops?.data || [];
        productsData = products?.data || [];
        categoriesData = categories || [];
      } catch (e) {
        console.error('Failed to fetch from API, using mock data', e);
      }

      const ordersToUse = Array.isArray(ordersData) ? ordersData : [];
      const shopsToUse = Array.isArray(shopsData) ? shopsData : [];
      const productsToUse = Array.isArray(productsData) ? productsData : [];
      const startDate = getRangeStartDate(timeRange);
      const rangeDurationMs = Date.now() - startDate.getTime();
      const previousStartDate = new Date(startDate.getTime() - rangeDurationMs);
      const scopedOrders = ordersToUse.filter((o: ApiOrder) => {
        const createdAt = new Date(o.createdAt);
        return !Number.isNaN(createdAt.getTime()) && createdAt >= startDate;
      });
      const previousOrders = ordersToUse.filter((o: ApiOrder) => {
        const createdAt = new Date(o.createdAt);
        return !Number.isNaN(createdAt.getTime()) && createdAt >= previousStartDate && createdAt < startDate;
      });

      const commissionRateByVendor = new Map(
        shopsToUse.map((s: ApiShop) => [String(s.id), Number(s.commissionRate ?? 10)])
      );

      const computeOrderCommission = (o: ApiOrder) => {
        const explicit = Number((o as any)?.commissionAmount || 0);
        if (explicit > 0) return explicit;

        const subOrders = Array.isArray((o as any)?.subOrders) ? (o as any).subOrders : [];
        if (subOrders.length > 0) {
          return subOrders.reduce((sum: number, sub: any) => {
            const vendorId = String(sub?.vendor?._id || sub?.vendor || '');
            const rate = Number(commissionRateByVendor.get(vendorId) ?? 10);
            const subtotal = Number(sub?.subtotal || sub?.totalAmount || 0);
            return sum + ((subtotal * rate) / 100);
          }, 0);
        }

        return (Number(o.totalAmount || 0) * 10) / 100;
      };

      if (scopedOrders.length >= 0) {
        const currentSales = scopedOrders.reduce((sum: number, o: ApiOrder) => sum + Number(o.totalAmount || 0), 0);
        const currentCommission = scopedOrders.reduce((sum: number, o: ApiOrder) => sum + computeOrderCommission(o), 0);
        const currentOrders = scopedOrders.length;
        const previousSales = previousOrders.reduce((sum: number, o: ApiOrder) => sum + Number(o.totalAmount || 0), 0);
        const previousCommission = previousOrders.reduce((sum: number, o: ApiOrder) => sum + computeOrderCommission(o), 0);
        const previousOrdersCount = previousOrders.length;

        const currentVendors = shopsToUse.filter((s: ApiShop) => s.status === 'approved' || s.status === 'active').length;
        const previousVendors = shopsToUse.filter((s: ApiShop) => {
          const createdAt = new Date(s.createdAt || '');
          return (s.status === 'approved' || s.status === 'active') && !Number.isNaN(createdAt.getTime()) && createdAt < startDate;
        }).length;

        const calcGrowth = (current: number, previous: number) => {
          if (previous <= 0) return current > 0 ? 100 : 0;
          return ((current - previous) / previous) * 100;
        };

        setTotalSales(currentSales);
        setTotalCommission(currentCommission);
        setTotalOrders(currentOrders);
        setGrowth({
          sales: calcGrowth(currentSales, previousSales),
          commission: calcGrowth(currentCommission, previousCommission),
          orders: calcGrowth(currentOrders, previousOrdersCount),
          vendors: calcGrowth(currentVendors, previousVendors),
        });

        const statusCounts: Record<string, number> = {};
        scopedOrders.forEach((o: ApiOrder) => {
          const key = mapOrderStatusToBucket(o);
          statusCounts[key] = (statusCounts[key] || 0) + 1;
        });
        setOrdersByStatus([
          { name: 'Pending', value: statusCounts['pending'] || 0, color: 'hsl(38, 92%, 50%)' },
          { name: 'Processing', value: statusCounts['processing'] || 0, color: 'hsl(190, 100%, 50%)' },
          { name: 'Shipped', value: statusCounts['shipped'] || 0, color: 'hsl(270, 100%, 60%)' },
          { name: 'Delivered', value: statusCounts['delivered'] || 0, color: 'hsl(142, 76%, 36%)' },
          { name: 'Cancelled', value: statusCounts['cancelled'] || 0, color: 'hsl(0, 72%, 51%)' },
        ]);

        const groupedData: Record<string, { sales: number; commission: number; orders: number }> = {};
        scopedOrders.forEach((o: ApiOrder) => {
          const created = new Date(o.createdAt);
          if (Number.isNaN(created.getTime())) return;
          const key = getBucketKey(created, timeRange);
          if (!groupedData[key]) groupedData[key] = { sales: 0, commission: 0, orders: 0 };
          groupedData[key].sales += Number(o.totalAmount || 0);
          groupedData[key].commission += computeOrderCommission(o);
          groupedData[key].orders += 1;
        });
        const sortedKeys = Object.keys(groupedData).sort();
        setSalesByMonth(sortedKeys.map((key) => ({ month: getBucketLabel(key, timeRange), ...groupedData[key] })));
      }

      setTotalVendors(shopsToUse.filter((s: ApiShop) => s.status === 'approved' || s.status === 'active').length);

      const categoryNameById = new Map((categoriesData || []).map((c: any) => [String(c?.id || c?._id), String(c?.name || 'Uncategorized')]));
      const productCategoryById = new Map<string, string>();
      productsToUse.forEach((p: ApiProduct) => {
        const productId = String((p as any)?.id || (p as any)?._id || '');
        if (!productId) return;
        const categoryId = String((p as any)?.categoryId || (p as any)?.category?.id || (p as any)?.category?._id || (p as any)?.category || '');
        if (categoryId) productCategoryById.set(productId, categoryId);
      });

      const categoryCounts: Record<string, number> = {};
      scopedOrders.forEach((order: ApiOrder) => {
        const items = Array.isArray((order as any)?.items) ? (order as any).items : [];
        items.forEach((item: any) => {
          const itemProduct = item?.product;
          const itemProductId = String(itemProduct?._id || itemProduct?.id || item?.productId || item?.product || '');
          const categoryId = String(
            itemProduct?.category?._id ||
            itemProduct?.category?.id ||
            itemProduct?.category ||
            productCategoryById.get(itemProductId) ||
            ''
          );
          const categoryName = itemProduct?.category?.name || categoryNameById.get(categoryId) || 'Uncategorized';
          const quantity = Number(item?.quantity || 1);
          categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1);
        });
      });
      setTopCategories(Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, value]) => ({ name, value })));
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'An error occurred', variant: 'destructive' });
    }
    setLoading(false);
  }, [toast, timeRange]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics, timeRange]);


  const stats = [
    { label: 'Total Sales', value: formatLKRCompact(totalSales), icon: DollarSign, change: growth.sales, color: 'text-primary' },
    { label: 'Commission Earned', value: formatLKRCompact(totalCommission), icon: TrendingUp, change: growth.commission, color: 'text-success' },
    { label: 'Total Orders', value: totalOrders.toLocaleString(), icon: ShoppingBag, change: growth.orders, color: 'text-purple-400' },
    { label: 'Active Vendors', value: totalVendors.toLocaleString(), icon: Users, change: growth.vendors, color: 'text-warning' },
  ];

  const categoryColors = ['hsl(190, 100%, 50%)', 'hsl(270, 100%, 60%)', 'hsl(330, 100%, 60%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)'];

  if (loading) return <AdminLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AdminLayout>;

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-3"><BarChart3 className="h-7 w-7 lg:h-8 lg:w-8 text-primary" />Platform Analytics</h1>
            <p className="text-muted-foreground mt-1">Monitor platform performance and growth metrics</p>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40 bg-secondary/50"><Calendar className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
            <SelectContent className="glass-card"><SelectItem value="7d">Last 7 days</SelectItem><SelectItem value="30d">Last 30 days</SelectItem><SelectItem value="90d">Last 90 days</SelectItem><SelectItem value="1y">Last year</SelectItem></SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="glass-card">
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 lg:p-3 rounded-lg bg-primary/10 border border-primary/30"><stat.icon className={`h-4 w-4 lg:h-5 lg:w-5 ${stat.color}`} /></div>
                    <div className={`flex items-center gap-1 text-xs lg:text-sm ${stat.change >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {stat.change >= 0 ? <ArrowUpRight className="h-3 w-3 lg:h-4 lg:w-4" /> : <ArrowDownRight className="h-3 w-3 lg:h-4 lg:w-4" />}
                      {`${stat.change >= 0 ? '+' : ''}${stat.change.toFixed(1)}%`}
                    </div>
                  </div>
                  <p className="text-lg lg:text-2xl font-display font-bold">{stat.value}</p>
                  <p className="text-xs lg:text-sm text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2 glass-card">
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" />Sales & Commission Trend</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[250px] lg:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesByMonth}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(190, 100%, 50%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(190, 100%, 50%)" stopOpacity={0} /></linearGradient>
                      <linearGradient id="commissionGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 10%, 18%)" />
                    <XAxis dataKey="month" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                    <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 10%, 18%)', borderRadius: '8px' }} formatter={(value: number) => formatLKR(value)} />
                    <Legend />
                    <Area type="monotone" dataKey="sales" stroke="hsl(190, 100%, 50%)" fill="url(#salesGradient)" strokeWidth={2} name="Sales" />
                    <Area type="monotone" dataKey="commission" stroke="hsl(142, 76%, 36%)" fill="url(#commissionGradient)" strokeWidth={2} name="Commission" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><ShoppingBag className="h-5 w-5 text-primary" />Orders by Status</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[180px] lg:h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={ordersByStatus.filter(s => s.value > 0)} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" strokeWidth={0}>{ordersByStatus.filter(s => s.value > 0).map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ backgroundColor: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 10%, 18%)', borderRadius: '8px' }} /></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">{ordersByStatus.map(item => (<div key={item.name} className="flex items-center justify-between text-sm"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-muted-foreground">{item.name}</span></div><span className="font-medium">{item.value}</span></div>))}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="glass-card">
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><Package className="h-5 w-5 text-primary" />Orders Trend</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[220px] lg:h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 10%, 18%)" />
                    <XAxis dataKey="month" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                    <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 10%, 18%)', borderRadius: '8px' }} />
                    <Bar dataKey="orders" fill="hsl(270, 100%, 60%)" radius={[4, 4, 0, 0]} name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Top Product Categories</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[220px] lg:h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCategories} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 10%, 18%)" />
                    <XAxis type="number" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="hsl(215, 20%, 55%)" width={80} fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 10%, 18%)', borderRadius: '8px' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Products">{topCategories.map((_, index) => <Cell key={`cell-${index}`} fill={categoryColors[index % categoryColors.length]} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </AdminLayout>
  );
};

export default SuperAdminAnalytics;
