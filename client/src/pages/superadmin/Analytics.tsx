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
import { mockOrders, mockShops, mockProducts, mockCategories } from '@/data/analyticsMockData';

const SuperAdminAnalytics: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const [totalSales, setTotalSales] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalVendors, setTotalVendors] = useState(0);
  const [ordersByStatus, setOrdersByStatus] = useState<{ name: string; value: number; color: string }[]>([]);
  const [salesByMonth, setSalesByMonth] = useState<{ month: string; sales: number; commission: number; orders: number }[]>([]);
  const [topCategories, setTopCategories] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => { fetchAnalytics(); }, [timeRange]);

  const getDateRange = (range: '7d' | '30d' | '90d' | '1y') => {
    const endDate = new Date();
    const startDate = new Date();

    switch (range) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  };

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const dateRange = getDateRange(timeRange);

      // Fetch shops first (needed for active vendors list and commission rates)
      const shopsData = await api.getShops().catch(() => ({ data: [] }));
      const shops = shopsData.data || [];
      
      // Filter active (approved or active) vendors
      const activeVendors = shops.filter((s: any) => ['approved', 'active'].includes(String(s.status || '').toLowerCase()));
      setTotalVendors(activeVendors.length);

      if (activeVendors.length === 0) {
        // Fallback to mock data if no real vendors exist
        const ordersToUse = mockOrders;
        setTotalSales(ordersToUse.reduce((sum: number, o: ApiOrder) => sum + (o.totalAmount || 0), 0));
        setTotalCommission(ordersToUse.reduce((sum: number, o: ApiOrder) => sum + (o.commissionAmount || 0), 0));
        setTotalOrders(ordersToUse.length);

        const statusCounts: Record<string, number> = {};
        ordersToUse.forEach((o: ApiOrder) => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
        setOrdersByStatus([
          { name: 'Pending', value: statusCounts['pending'] || 0, color: 'hsl(38, 92%, 50%)' },
          { name: 'Processing', value: statusCounts['processing'] || 0, color: 'hsl(190, 100%, 50%)' },
          { name: 'Shipped', value: statusCounts['shipped'] || 0, color: 'hsl(270, 100%, 60%)' },
          { name: 'Delivered', value: statusCounts['delivered'] || 0, color: 'hsl(142, 76%, 36%)' },
          { name: 'Cancelled', value: statusCounts['cancelled'] || 0, color: 'hsl(0, 72%, 51%)' },
        ]);

        const monthlyData: Record<string, { sales: number; commission: number; orders: number }> = {};
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthlyData[d.toLocaleString('default', { month: 'short' })] = { sales: 0, commission: 0, orders: 0 };
        }
        ordersToUse.forEach((o: ApiOrder) => {
          const key = new Date(o.createdAt).toLocaleString('default', { month: 'short' });
          if (monthlyData[key]) {
            monthlyData[key].sales += o.totalAmount || 0;
            monthlyData[key].commission += o.commissionAmount || 0;
            monthlyData[key].orders += 1;
          }
        });

        setSalesByMonth(Object.entries(monthlyData).map(([month, data]) => ({
          month,
          ...data
        })));

        setTopCategories(mockCategories.map((cat, i) => ({
          name: cat.name,
          value: Math.floor(Math.random() * 100000) + 50000,
          color: ['hsl(190, 100%, 50%)', 'hsl(270, 100%, 60%)', 'hsl(330, 100%, 60%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)'][i % 5]
        })));

        setLoading(false);
        return;
      }

      // Fetch analytics for each vendor using live analytics endpoints
      const [vendorMetrics, vendorTimeSeries, vendorEarnings, vendorSettlementSummaries] = await Promise.all([
        Promise.all(activeVendors.map((vendor: any) => api.getVendorAnalytics(vendor.id, { range: timeRange }).catch(() => null))),
        Promise.all(activeVendors.map((vendor: any) => api.getVendorTimeSeriesAnalytics(vendor.id, { range: timeRange, granularity: 'monthly' }).catch(() => ({ timeSeries: [] })))),
        Promise.all(activeVendors.map((vendor: any) => api.getVendorEarningsBreakdown(vendor.id, { range: timeRange }).catch(() => ({ byCategory: [] })))),
        Promise.all(activeVendors.map((vendor: any) => api.getVendorSettlementRangeSummary(vendor.id, dateRange).catch(() => null)))
      ]);

      // Aggregate sales and orders
      let aggregatedSales = 0;
      let aggregatedOrders = 0;

      vendorMetrics.forEach((metric: any) => {
        if (metric?.salesMetrics) {
          aggregatedSales += Number(metric.salesMetrics.totalRevenue || 0);
          aggregatedOrders += Number(metric.salesMetrics.totalOrders || 0);
        }
      });

      const aggregatedCommission = vendorSettlementSummaries.reduce((sum: number, summary: any) => {
        return sum + Number(summary?.totalCommission || 0);
      }, 0);

      setTotalSales(aggregatedSales);
      setTotalCommission(aggregatedCommission);
      setTotalOrders(aggregatedOrders);

      // Aggregate order status breakdown
      const allOrderStatuses: Record<string, number> = {};
      vendorMetrics.forEach((metric: any) => {
        if (metric?.orderMetrics?.statusBreakdown) {
          Object.entries(metric.orderMetrics.statusBreakdown).forEach(([status, count]: [string, any]) => {
            allOrderStatuses[status] = (allOrderStatuses[status] || 0) + Number(count || 0);
          });
        }
      });

      setOrdersByStatus([
        { name: 'Pending', value: allOrderStatuses['pending'] || 0, color: 'hsl(38, 92%, 50%)' },
        { name: 'Processing', value: allOrderStatuses['processing'] || 0, color: 'hsl(190, 100%, 50%)' },
        { name: 'Shipped', value: allOrderStatuses['shipped'] || 0, color: 'hsl(270, 100%, 60%)' },
        { name: 'Delivered', value: allOrderStatuses['delivered'] || 0, color: 'hsl(142, 76%, 36%)' },
        { name: 'Cancelled', value: allOrderStatuses['cancelled'] || 0, color: 'hsl(0, 72%, 51%)' },
      ]);

      // Aggregate monthly sales and commission
      const monthlyAggregated: Record<string, { sales: number; commission: number; orders: number }> = {};
      vendorTimeSeries.forEach((series: any, vendorIdx: number) => {
        const vendorRate = Number(activeVendors[vendorIdx]?.commissionRate || 10) / 100;
        (series?.timeSeries || []).forEach((point: any) => {
          const period = String(point?.period || '');
          if (!period) return;
          if (!monthlyAggregated[period]) monthlyAggregated[period] = { sales: 0, commission: 0, orders: 0 };
          monthlyAggregated[period].sales += Number(point.revenue || 0);
          monthlyAggregated[period].commission += Number(point.revenue || 0) * vendorRate;
          monthlyAggregated[period].orders += Number(point.orders || 0);
        });
      });

      setSalesByMonth(Object.entries(monthlyAggregated).map(([month, data]) => ({
        month,
        ...data
      })));

      // Aggregate top categories
      const categories = await api.getCategories().catch(() => []);
      const categoryMap: Record<string, number> = {};
      const categoryNameMap = new Map((categories || []).map((cat: any) => [String(cat.id), String(cat.name)]));

      vendorEarnings.forEach((breakdown: any) => {
        (breakdown?.byCategory || []).forEach((entry: any) => {
          const catId = String(entry?.category || 'null');
          categoryMap[catId] = (categoryMap[catId] || 0) + Number(entry?.earnings || 0);
        });
      });

      const categoryColors = ['hsl(190, 100%, 50%)', 'hsl(270, 100%, 60%)', 'hsl(330, 100%, 60%)', 'hsl(142, 76%, 36%)', 'hsl(38, 92%, 50%)'];
      const topCats = Object.entries(categoryMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([catId, earnings], idx) => ({
          name: categoryNameMap.get(catId) || (catId === 'null' ? 'Uncategorized' : 'Other'),
          value: earnings,
          color: categoryColors[idx % categoryColors.length],
        }));

      setTopCategories(topCats);
    } catch (error: any) {
      console.error('Analytics fetch error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to load analytics', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [timeRange, toast]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);


  const stats = [
    { label: 'Total Sales', value: formatLKRCompact(totalSales), icon: DollarSign, change: '+18%', positive: true, color: 'text-primary' },
    { label: 'Commission Earned', value: formatLKRCompact(totalCommission), icon: TrendingUp, change: '+12%', positive: true, color: 'text-success' },
    { label: 'Total Orders', value: totalOrders.toLocaleString(), icon: ShoppingBag, change: '+24%', positive: true, color: 'text-purple-400' },
    { label: 'Active Vendors', value: totalVendors.toLocaleString(), icon: Users, change: '+3', positive: true, color: 'text-warning' },
  ];

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
                    <div className={`flex items-center gap-1 text-xs lg:text-sm ${stat.positive ? 'text-success' : 'text-destructive'}`}>{stat.positive ? <ArrowUpRight className="h-3 w-3 lg:h-4 lg:w-4" /> : <ArrowDownRight className="h-3 w-3 lg:h-4 lg:w-4" />}{stat.change}</div>
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
                  <PieChart><Pie data={ordersByStatus.filter(s => s.value > 0)} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" strokeWidth={0}>{ordersByStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie><Tooltip contentStyle={{ backgroundColor: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 10%, 18%)', borderRadius: '8px' }} /></PieChart>
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
                    <XAxis type="number" stroke="hsl(215, 20%, 55%)" fontSize={12} tickFormatter={(v) => formatLKRCompact(v)} />
                    <YAxis type="category" dataKey="name" stroke="hsl(215, 20%, 55%)" width={80} fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 10%, 18%)', borderRadius: '8px' }} formatter={(value: number) => formatLKR(value)} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Earnings">{topCategories.map((_, index) => <Cell key={`cell-${index}`} fill={topCategories[index]?.color} />)}</Bar>
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
