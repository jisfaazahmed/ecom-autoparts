import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, DollarSign, TrendingUp, CheckCircle, XCircle, Clock, BarChart3, ArrowUpRight, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatLKR } from '@/lib/currency';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Shop {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  status: string;
  commissionRate?: number | null;
  createdAt?: string;
}

const SuperAdminDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  
  const [shops, setShops] = useState<Shop[]>([]);
  const [totalSales, setTotalSales] = useState(0);
  const [pendingRefunds, setPendingRefunds] = useState(0);
  const [salesData, setSalesData] = useState<Array<{ month: string; sales: number; commission: number }>>([]);
  const [categoryData, setCategoryData] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [loading, setLoading] = useState(true);

  const chartColors = [
    'hsl(190, 100%, 50%)',
    'hsl(270, 100%, 60%)',
    'hsl(330, 100%, 60%)',
    'hsl(142, 76%, 36%)',
    'hsl(38, 92%, 50%)',
    'hsl(215, 80%, 60%)',
  ];

  const toMonthLabel = (period: string) => {
    const date = new Date(`${period}-01T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return period;
    return date.toLocaleString(undefined, { month: 'short' });
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [shopsData, refundsData, categories, analyticsData] = await Promise.all([
        api.getShops(),
        api.getAdminRefunds({ limit: 200 }),
        api.getCategories(),
        api.getSuperAdminAnalytics({ range: '1y' })
      ]);

      setShops(shopsData.data);
      setPendingRefunds((refundsData.refunds || []).filter((refund) => String(refund.status || '').toLowerCase() === 'requested').length);

      setTotalSales(analyticsData.totalSales || 0);

      const salesSeries = (analyticsData.salesByMonth || []).map(item => ({
        month: toMonthLabel(item.month),
        sales: item.sales,
        commission: item.commission
      }));
      setSalesData(salesSeries);

      const categoryNameById = new Map((categories || []).map((cat: any) => [String(cat.id), String(cat.name)]));
      const totalCategoryEarnings = (analyticsData.topCategories || []).reduce((sum, c) => sum + (c.earnings || 0), 0);
      
      const topCategories = (analyticsData.topCategories || []).map((c, index) => ({
        name: categoryNameById.get(c.categoryId) || (c.categoryId === 'null' ? 'Uncategorized' : 'Other'),
        value: totalCategoryEarnings > 0 ? Math.round(((c.earnings || 0) / totalCategoryEarnings) * 100) : 0,
        color: chartColors[index % chartColors.length]
      })).filter(entry => entry.value > 0);

      setCategoryData(topCategories);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const updateShopStatus = async (shopId: string, status: 'approved' | 'rejected') => {
    try {
      await api.updateShopStatus(shopId, status);
      setShops(shops.map(s => s.id === shopId ? { ...s, status } : s));
      toast({ title: 'Shop Updated', description: `Shop has been ${status}` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const commission = totalSales * 0.1;
  const pendingVendors = shops.filter(s => s.status === 'pending').length;
  const approvedVendors = shops.filter(s => s.status === 'approved').length;

  const stats = [
    { label: 'Total Sales', value: formatLKR(totalSales), icon: DollarSign, change: '+18%', positive: true },
    { label: 'Commission Earned', value: formatLKR(commission), icon: TrendingUp, change: '+12%', positive: true },
    { label: 'Active Vendors', value: approvedVendors, icon: Building2, change: '+3', positive: true },
    { label: 'Pending Approvals', value: pendingVendors, icon: Clock, change: pendingVendors > 0 ? 'Needs attention' : 'All clear', positive: pendingVendors === 0 },
    { label: 'Pending Refund Reviews', value: pendingRefunds, icon: AlertCircle, change: pendingRefunds > 0 ? 'Needs attention' : 'All clear', positive: pendingRefunds === 0 },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <Badge className="bg-success/20 text-success border-success/30"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'pending': return <Badge className="bg-warning/20 text-warning border-warning/30"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'rejected': return <Badge className="bg-destructive/20 text-destructive border-destructive/30"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default: return null;
    }
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
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Platform Overview</h1>
          <p className="text-muted-foreground">Welcome back, {profile?.full_name}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6 mb-8">
          {stats.map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 lg:p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <stat.icon className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                </div>
                <div className={`flex items-center gap-1 text-xs lg:text-sm ${stat.positive ? 'text-success' : 'text-warning'}`}>
                  <ArrowUpRight className="h-3 w-3 lg:h-4 lg:w-4" />{stat.change}
                </div>
              </div>
              <p className="text-lg lg:text-2xl font-display font-bold">{stat.value}</p>
              <p className="text-xs lg:text-sm text-muted-foreground">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2 glass-card border-border/50">
            <CardHeader><CardTitle className="font-display flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary" />Sales & Commission</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[250px] lg:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesData}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(190, 100%, 50%)" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(190, 100%, 50%)" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 10%, 18%)" />
                    <XAxis dataKey="month" stroke="hsl(215, 20%, 55%)" fontSize={12} />
                    <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} tickFormatter={(v) => `${(v/1000000).toFixed(1)}M`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(240, 10%, 6%)', border: '1px solid hsl(240, 10%, 18%)', borderRadius: '8px' }} 
                      formatter={(value: number) => formatLKR(value)}
                    />
                    <Area type="monotone" dataKey="sales" stroke="hsl(190, 100%, 50%)" fill="url(#salesGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-border/50">
            <CardHeader><CardTitle className="font-display">Sales by Category</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[180px] lg:h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={categoryData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" strokeWidth={0}>{categoryData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}</Pie></PieChart>
                </ResponsiveContainer>
              </div>
              {categoryData.length > 0 ? (
                <div className="space-y-2 mt-4">
                  {categoryData.map(cat => (
                    <div key={cat.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} /><span className="text-muted-foreground">{cat.name}</span></div>
                      <span className="font-medium">{cat.value}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-4">No category analytics available yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card border-border/50">
          <CardHeader><CardTitle className="font-display flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Vendor Management</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Shop Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Commission Rate</TableHead>
                    <TableHead className="hidden md:table-cell">Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shops.map(shop => (
                    <TableRow key={shop.id} className="border-border/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
                            <Building2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{shop.name}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1 hidden sm:block">{shop.description}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(shop.status)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{shop.commissionRate || 10}%</TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">{shop.createdAt ? new Date(shop.createdAt).toLocaleDateString() : '-'}</TableCell>
                      <TableCell className="text-right">
                        {shop.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10" onClick={() => updateShopStatus(shop.id, 'approved')}>
                              <CheckCircle className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Approve</span>
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => updateShopStatus(shop.id, 'rejected')}>
                              <XCircle className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Reject</span>
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AdminLayout>
  );
};

export default SuperAdminDashboard;
