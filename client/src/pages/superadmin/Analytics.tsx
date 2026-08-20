import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, DollarSign, TrendingUp, ShoppingBag, Users, Package, Loader2, Calendar, ArrowUpRight, ArrowDownRight, Download, Clock, RefreshCw, Truck, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import AdminLayout from '@/components/layout/AdminLayout';
import { api, ApiOrder, ApiShop, ApiProduct, ApiCategory } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatLKR, formatLKRCompact } from '@/lib/currency';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import AnalyticsAIChat from './AnalyticsAIChat';
// Use live data via API; remove mock fallbacks

interface AnalyticsData {
  totalSales: number;
  totalCommission: number;
  totalOrders: number;
  totalVendors: number;
  aov: number;
  totalRefunds: number;
  topVendors: { shopName: string; name: string; sales: number; orders: number }[];
  ordersByStatus: Record<string, number>;
  salesByMonth: { month: string; sales: number; commission: number; orders: number }[];
  topCategories: { categoryId: string; earnings: number }[];
}

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
  const [topCategories, setTopCategories] = useState<{ name: string; value: number; color: string }[]>([]);
  const [aov, setAov] = useState(0);
  const [totalRefunds, setTotalRefunds] = useState(0);
  const [topVendors, setTopVendors] = useState<{ shopName: string; name: string; sales: number; orders: number }[]>([]);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);

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
      const data = await api.getSuperAdminAnalytics({ range: timeRange });

      setAnalyticsData(data);
      setTotalVendors(data.totalVendors || 0);
      setTotalSales(data.totalSales || 0);
      setTotalCommission(data.totalCommission || 0);
      setTotalOrders(data.totalOrders || 0);
      setAov(data.aov || 0);
      setTotalRefunds(data.totalRefunds || 0);
      setTopVendors(data.topVendors || []);

      const st = data.ordersByStatus || {};
      setOrdersByStatus([
        { name: 'Pending', value: st['pending'] || 0, color: 'hsl(38, 92%, 50%)' },
        { name: 'Processing', value: st['processing'] || 0, color: 'hsl(190, 100%, 50%)' },
        { name: 'Shipped', value: st['shipped'] || 0, color: 'hsl(270, 100%, 60%)' },
        { name: 'Delivered', value: st['delivered'] || 0, color: 'hsl(142, 76%, 36%)' },
        { name: 'Cancelled', value: st['cancelled'] || 0, color: 'hsl(0, 72%, 51%)' },
      ]);

      setSalesByMonth(data.salesByMonth || []);

      const categories = await api.getCategories().catch(() => []);
      const categoryNameMap = new Map((categories || []).map((cat: { id: string; name: string }) => [String(cat.id), String(cat.name)]));

      const categoryColors = ['#0e7490', '#22d3ee', '#67e8f9', '#a5f3fc', '#cffafe'];
      const topCats = (data.topCategories || []).map((c, idx) => ({
        name: categoryNameMap.get(c.categoryId) || (c.categoryId === 'null' ? 'Uncategorized' : 'Other'),
        value: c.earnings,
        color: categoryColors[idx % categoryColors.length],
      }));

      setTopCategories(topCats);

    } catch (error: unknown) {
      console.error('Analytics fetch error:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to load analytics', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [timeRange, toast]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();

      // Header Configuration
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(33, 37, 41);
      doc.text('Ecom AutoParts - Platform Analytics Report', 14, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      const dateRangeText = {
        '7d': 'Last 7 Days',
        '30d': 'Last 30 Days',
        '90d': 'Last 90 Days',
        '1y': 'Last Year'
      }[timeRange];
      doc.text(`Report Period: ${dateRangeText} (Generated on: ${new Date().toLocaleDateString()})`, 14, 27);

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 32, 196, 32);

      // Section 1: Summary Metrics Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text('Performance Summary', 14, 42);

      const summaryHeaders = [['Metric', 'Value']];
      const summaryRows = [
        ['Total Sales', formatLKR(totalSales)],
        ['Commission Earned', formatLKR(totalCommission)],
        ['Total Orders', totalOrders.toLocaleString()],
        ['Average Order Value (AOV)', formatLKR(aov)],
        ['Total Refunds', formatLKR(totalRefunds)],
        ['Active Vendors', totalVendors.toLocaleString()]
      ];

      doc.autoTable({
        startY: 47,
        head: summaryHeaders,
        body: summaryRows,
        theme: 'striped',
        headStyles: { fillColor: [6, 182, 212] }, // Cyan theme matches primary colors
        margin: { left: 14, right: 14 }
      });

      // Section 2: Top Performing Vendors Table
      const finalY1 = doc.lastAutoTable.finalY;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Top Performing Vendors', 14, finalY1 + 15);

      const vendorHeaders = [['Rank', 'Shop Name', 'Vendor Name', 'Total Orders', 'Total Revenue']];
      const vendorRows = topVendors.map((vendor, index) => [
        String(index + 1),
        vendor.shopName || 'N/A',
        vendor.name || 'N/A',
        vendor.orders.toLocaleString(),
        formatLKR(vendor.sales)
      ]);

      doc.autoTable({
        startY: finalY1 + 20,
        head: vendorHeaders,
        body: vendorRows.length > 0 ? vendorRows : [['-', 'No vendor data available', '-', '-', '-']],
        theme: 'grid',
        headStyles: { fillColor: [6, 182, 212] },
        margin: { left: 14, right: 14 }
      });

      // Section 3: Top Product Categories
      const finalY2 = doc.lastAutoTable.finalY;
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Top Product Categories', 14, finalY2 + 15);

      const categoryHeaders = [['Category Name', 'Total Earnings']];
      const categoryRows = topCategories.map(cat => [
        cat.name || 'N/A',
        formatLKR(cat.value)
      ]);

      doc.autoTable({
        startY: finalY2 + 20,
        head: categoryHeaders,
        body: categoryRows.length > 0 ? categoryRows : [['No category data available', '-']],
        theme: 'grid',
        headStyles: { fillColor: [6, 182, 212] },
        margin: { left: 14, right: 14 }
      });

      doc.save(`platform-analytics-${timeRange}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: 'Success', description: 'PDF report downloaded successfully' });
    } catch (err: unknown) {
      console.error('PDF export failed:', err);
      toast({ title: 'Export Error', description: (err as Error).message || 'Failed to export PDF', variant: 'destructive' });
    }
  };


  const stats = [
    { label: 'Total Sales', value: formatLKRCompact(totalSales), icon: DollarSign, change: totalSales > 0 ? 'Live data' : 'No data', positive: totalSales > 0, color: 'text-primary' },
    { label: 'Commission Earned', value: formatLKRCompact(totalCommission), icon: TrendingUp, change: totalCommission > 0 ? 'Live data' : 'No data', positive: totalCommission > 0, color: 'text-success' },
    { label: 'Total Orders', value: totalOrders.toLocaleString(), icon: ShoppingBag, change: '+24%', positive: true, color: 'text-purple-400' },
    { label: 'Average Order Value', value: formatLKRCompact(aov), icon: DollarSign, change: '+5%', positive: true, color: 'text-blue-400' },
    { label: 'Total Refunds', value: formatLKRCompact(totalRefunds), icon: TrendingUp, change: '-2%', positive: false, color: 'text-destructive' },
    { label: 'Active Vendors', value: totalVendors.toLocaleString(), icon: Users, change: totalVendors > 0 ? 'Live data' : 'No vendors', positive: totalVendors > 0, color: 'text-warning' },
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
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleExportPDF} variant="outline" className="bg-secondary/50 border border-primary/20 hover:bg-primary/10">
              <Download className="h-4 w-4 mr-2 text-primary" /> Export PDF
            </Button>
            <Select value={timeRange} onValueChange={(val: '7d' | '30d' | '90d' | '1y') => setTimeRange(val)}>
              <SelectTrigger className="w-40 bg-secondary/50"><Calendar className="h-4 w-4 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent className="glass-card"><SelectItem value="7d">Last 7 days</SelectItem><SelectItem value="30d">Last 30 days</SelectItem><SelectItem value="90d">Last 90 days</SelectItem><SelectItem value="1y">Last year</SelectItem></SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
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
              <div className="h-[330px] lg:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesByMonth} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(190, 100%, 50%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(190, 100%, 50%)" stopOpacity={0} /></linearGradient>
                      <linearGradient id="commissionGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 10%, 18%)" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      stroke="hsl(215, 20%, 55%)" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                      dy={10}
                    />
                    <YAxis 
                      stroke="hsl(215, 20%, 55%)" 
                      fontSize={12} 
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : v} 
                      tickLine={false} 
                      axisLine={false} 
                      width={45} 
                    />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 10%, 18%)', borderRadius: '8px' }} formatter={(value: number) => formatLKR(value)} />
                    <Legend verticalAlign="top" height={36} iconType="circle" />
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
              <div className="relative h-[180px] lg:h-[200px]">
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                  <span className="text-2xl font-bold font-display leading-none text-foreground">
                    {ordersByStatus.reduce((acc, curr) => acc + curr.value, 0)}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">Total Orders</span>
                </div>
                <div className="absolute inset-0 z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={ordersByStatus.filter(s => s.value > 0)} 
                        cx="50%" cy="50%" 
                        innerRadius={50} outerRadius={70} 
                        dataKey="value" 
                        nameKey="name"
                        strokeWidth={0}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {ordersByStatus.filter(s => s.value > 0).map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 10%, 18%)', borderRadius: '8px' }} 
                        itemStyle={{ color: '#f8fafc' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-1.5 mt-4">
                {ordersByStatus.map(item => {
                  const totalStatusOrders = ordersByStatus.reduce((acc, curr) => acc + curr.value, 0);
                  const percentage = totalStatusOrders > 0 ? Math.round((item.value / totalStatusOrders) * 100) : 0;
                  
                  let StatusIcon = Clock;
                  if (item.name === 'Processing') StatusIcon = RefreshCw;
                  if (item.name === 'Shipped') StatusIcon = Truck;
                  if (item.name === 'Delivered') StatusIcon = CheckCircle2;
                  if (item.name === 'Cancelled') StatusIcon = XCircle;
                  
                  return (
                    <div key={item.name} className="flex items-center text-sm py-0.5">
                      <div className="flex items-center gap-2.5 flex-1">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <StatusIcon className="w-3.5 h-3.5" />
                          <span>{item.name}</span>
                        </div>
                      </div>
                      <div className="w-24 text-right font-medium text-foreground">
                        {item.value} <span className="text-muted-foreground font-normal">({percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 10%, 18%)', borderRadius: '8px' }} itemStyle={{ color: '#f8fafc' }} />
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
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 10%, 18%)', borderRadius: '8px' }} itemStyle={{ color: '#f8fafc' }} formatter={(value: number) => formatLKR(value)} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Earnings">{topCategories.map((_, index) => <Cell key={`cell-${index}`} fill={topCategories[index]?.color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 mb-6">
          <Card className="lg:col-span-3 glass-card">
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><Users className="h-5 w-5 text-primary" />Top Performing Vendors</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Rank</th>
                      <th className="px-4 py-3 font-medium">Shop Name</th>
                      <th className="px-4 py-3 font-medium">Vendor Name</th>
                      <th className="px-4 py-3 font-medium text-right">Total Orders</th>
                      <th className="px-4 py-3 font-medium text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topVendors.length > 0 ? topVendors.map((vendor, index) => (
                      <tr key={index} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${index === 0 ? 'bg-amber-500/20 text-amber-500' : index === 1 ? 'bg-slate-300/20 text-slate-300' : index === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-secondary text-muted-foreground'}`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{vendor.shopName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{vendor.name}</td>
                        <td className="px-4 py-3 text-right">{vendor.orders.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-medium text-success">{formatLKR(vendor.sales)}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No vendor data available for this period</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <AnalyticsAIChat analyticsData={analyticsData} dateRange={timeRange} />
      </motion.div>
    </AdminLayout>
  );
};

export default SuperAdminAnalytics;
