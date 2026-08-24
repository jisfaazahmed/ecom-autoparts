import React, { useEffect, useState, useCallback } from 'react';
import { CreditCard, TrendingUp, DollarSign, Clock, RefreshCw, ChevronDown, Zap } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api, ApiShop } from '@/lib/api';
import { formatLKR } from '@/lib/currency';
import { toast } from 'sonner';

interface Settlement {
  _id: string;
  amount?: number;
  totalPayable?: number;
  payableAmount?: number;
  status: string;
  period?: { start: string; end: string };
  settlementPeriod?: { startDate: string; endDate: string };
  createdAt: string;
  vendor?: { name?: string; shopName?: string };
}

interface Summary {
  totalSettlements: number;
  totalCommission: number;
  totalPayable: number;
  totalOrderAmount: number;
  totalRefunded: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  processing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const thirtyDaysAgoIso = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

const Settlements: React.FC = () => {
  const [shops, setShops] = useState<ApiShop[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [rangeStart, setRangeStart] = useState(thirtyDaysAgoIso());
  const [rangeEnd, setRangeEnd] = useState(todayIso());

  useEffect(() => {
    const fetchShops = async () => {
      try {
        const res = await api.getAllShops({ status: 'approved', limit: 200 });
        setShops(res.data || []);
        if (res.data?.length > 0) setSelectedVendorId(res.data[0].id);
      } catch {
        toast.error('Failed to load vendors');
      } finally {
        setShopsLoading(false);
      }
    };
    fetchShops();
  }, []);

  const fetchSettlements = useCallback(async () => {
    if (!selectedVendorId) return;
    setLoading(true);
    try {
      const [settlementsRes, summaryRes] = await Promise.allSettled([
        api.getVendorSettlements(selectedVendorId, { limit: 50 }),
        api.getVendorSettlementRangeSummary(selectedVendorId),
      ]);
      if (settlementsRes.status === 'fulfilled') {
        const data = settlementsRes.value as Settlement[] | { settlements?: Settlement[] };
        setSettlements(Array.isArray(data) ? data : data.settlements || []);
      }
      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value);
      }
    } catch {
      toast.error('Failed to load settlements');
    } finally {
      setLoading(false);
    }
  }, [selectedVendorId]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const handleGenerateSettlement = async () => {
    if (!selectedVendorId) return;
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      toast.error('Pick a valid start and end date');
      return;
    }
    setGenerating(true);
    try {
      await api.createVendorSettlement(selectedVendorId, rangeStart, rangeEnd);
      toast.success('Settlement generated');
      fetchSettlements();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate settlement');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-primary" />
              Settlements
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage vendor payouts and settlement history
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchSettlements} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Vendor selector */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium whitespace-nowrap">Select Vendor:</label>
          <Select value={selectedVendorId} onValueChange={setSelectedVendorId} disabled={shopsLoading}>
            <SelectTrigger className="w-64 bg-secondary/50">
              <SelectValue placeholder={shopsLoading ? 'Loading…' : 'Pick a vendor'} />
            </SelectTrigger>
            <SelectContent className="glass-card">
              {shops.map((shop) => (
                <SelectItem key={shop.id} value={shop.id}>
                  {shop.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-0 sm:ml-4">
            <label className="text-sm font-medium whitespace-nowrap">Period:</label>
            <Input
              type="date"
              value={rangeStart}
              max={rangeEnd}
              onChange={(e) => setRangeStart(e.target.value)}
              className="w-40 bg-secondary/50"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              value={rangeEnd}
              min={rangeStart}
              max={todayIso()}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="w-40 bg-secondary/50"
            />
          </div>

          <Button
            size="sm"
            onClick={handleGenerateSettlement}
            disabled={generating || !selectedVendorId}
          >
            <Zap className={`h-4 w-4 mr-2 ${generating ? 'animate-pulse' : ''}`} />
            {generating ? 'Generating…' : 'Generate Settlement'}
          </Button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Order Amount', value: formatLKR(summary.totalOrderAmount), icon: TrendingUp, color: 'text-blue-400' },
              { label: 'Commission Earned', value: formatLKR(summary.totalCommission), icon: DollarSign, color: 'text-orange-400' },
              { label: 'Total Payable', value: formatLKR(summary.totalPayable), icon: CreditCard, color: 'text-green-400' },
              { label: 'Pending Settlements', value: String(summary.totalSettlements), icon: Clock, color: 'text-yellow-400' },
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
        )}

        {/* Settlements Table */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/40 flex items-center justify-between">
            <h2 className="font-semibold">Settlement History</h2>
            <span className="text-xs text-muted-foreground">{settlements.length} records</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : settlements.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No settlements found for this vendor.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 bg-secondary/20">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Settlement ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s) => (
                    <tr key={s._id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {s._id.slice(-8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {s.period
                          ? `${new Date(s.period.start).toLocaleDateString()} – ${new Date(s.period.end).toLocaleDateString()}`
                          : s.settlementPeriod
                          ? `${new Date(s.settlementPeriod.startDate).toLocaleDateString()} – ${new Date(s.settlementPeriod.endDate).toLocaleDateString()}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">
                        {formatLKR(s.payableAmount ?? s.totalPayable ?? s.amount ?? 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            STATUS_COLORS[s.status] || 'bg-secondary text-muted-foreground border-border'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(s.createdAt).toLocaleDateString()}
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

export default Settlements;
