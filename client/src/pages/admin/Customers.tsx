import React, { useEffect, useState, useMemo } from 'react';
import { Users, TrendingUp, ShoppingBag, Search } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatLKR } from '@/lib/currency';
import { toast } from 'sonner';

interface Customer {
  customerId: string;
  name: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string;
}

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.getSellerCustomers();
        setCustomers(res.data || []);
      } catch {
        toast.error('Failed to load customers');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Customers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Customers who have ordered from your shop
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Customers', value: String(customers.length), icon: Users, color: 'text-blue-400' },
            { label: 'Total Orders', value: String(totalOrders), icon: ShoppingBag, color: 'text-orange-400' },
            { label: 'Total Revenue', value: formatLKR(totalRevenue), icon: TrendingUp, color: 'text-green-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-xl font-bold">{value}</p>
            </div>
          ))}
        </div>

        {/* Search + Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/40 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <h2 className="font-semibold">Customer List</h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-secondary/50"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>{search ? 'No customers match your search.' : 'No customers yet.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-secondary/20">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Orders</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total Spent</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Last Order</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((customer) => (
                    <tr
                      key={customer.customerId}
                      className="border-b border-border/20 hover:bg-secondary/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{customer.name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">{customer.email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{customer.email}</td>
                      <td className="px-4 py-3 text-right">{customer.totalOrders}</td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">
                        {formatLKR(customer.totalSpent)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                        {customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default Customers;
