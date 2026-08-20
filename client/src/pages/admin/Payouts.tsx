import React, { useEffect, useMemo, useState } from 'react';
import { Wallet, TrendingUp, Receipt, Clock, Filter, FileText } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api, ApiSettlement, ApiEarningsBreakdown } from '@/lib/api';
import { formatLKR } from '@/lib/currency';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const statusColorMap: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const titleCase = (value?: string) =>
  String(value || '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString() : '—';

const formatPeriod = (settlement: ApiSettlement) =>
  `${formatDate(settlement.settlementPeriod?.startDate)} – ${formatDate(settlement.settlementPeriod?.endDate)}`;

const Payouts: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<ApiSettlement[]>([]);
  const [currentPeriod, setCurrentPeriod] = useState<ApiSettlement | null>(null);
  const [payable, setPayable] = useState({ totalPayable: 0, totalSettlements: 0 });
  const [breakdown, setBreakdown] = useState<ApiEarningsBreakdown>({ byCategory: [] });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selected, setSelected] = useState<ApiSettlement | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        // Each call is independently tolerant: a seller with no settlements yet
        // should still see the page rather than a blanket error.
        const [list, summary, payableResult, earnings] = await Promise.all([
          api.getMySettlements({
            limit: 50,
            status: statusFilter === 'all' ? undefined : statusFilter,
          }),
          api.getMySettlementSummary(),
          api.getMyPayable(),
          api.getMyEarningsBreakdown('30d'),
        ]);

        setSettlements(list?.settlements || []);
        setCurrentPeriod(summary || null);
        setPayable(payableResult || { totalPayable: 0, totalSettlements: 0 });
        setBreakdown(earnings || { byCategory: [] });
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to load payouts'
        );
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [statusFilter]);

  const pendingTotal = useMemo(
    () =>
      settlements
        .filter((s) => s.status === 'pending' || s.status === 'processing')
        .reduce((sum, s) => sum + (s.payableAmount || 0), 0),
    [settlements]
  );

  const paidTotal = useMemo(
    () =>
      settlements
        .filter((s) => s.status === 'completed')
        .reduce((sum, s) => sum + (s.payableAmount || 0), 0),
    [settlements]
  );

  const summaryCards = [
    {
      label: 'Total Payable',
      value: formatLKR(payable.totalPayable || 0),
      hint: `${payable.totalSettlements || 0} settlement(s)`,
      icon: Wallet,
      color: 'text-primary',
    },
    {
      label: 'Awaiting Payout',
      value: formatLKR(pendingTotal),
      hint: 'Pending + processing',
      icon: Clock,
      color: 'text-amber-400',
    },
    {
      label: 'Paid Out',
      value: formatLKR(paidTotal),
      hint: 'Completed settlements',
      icon: TrendingUp,
      color: 'text-green-400',
    },
    {
      label: 'This Period (Net)',
      value: formatLKR(currentPeriod?.payableAmount || 0),
      hint: currentPeriod ? formatPeriod(currentPeriod) : 'No activity yet',
      icon: Receipt,
      color: 'text-blue-400',
    },
  ];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Payouts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your earnings, platform commission, and settlement history.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map(({ label, value, hint, icon: Icon, color }) => (
            <div key={label} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{hint}</p>
            </div>
          ))}
        </div>

        {/* Current period breakdown */}
        {currentPeriod && (
          <div className="glass-card rounded-xl p-4">
            <h2 className="font-semibold mb-3">Current Period</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Orders</p>
                <p className="font-medium">{currentPeriod.ordersSummary?.totalOrders ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gross Sales</p>
                <p className="font-medium">{formatLKR(currentPeriod.ordersSummary?.totalOrderAmount || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Commission ({currentPeriod.commission?.rate ?? 0}%)
                </p>
                <p className="font-medium text-red-400">
                  −{formatLKR(currentPeriod.commission?.totalCommission || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Charges</p>
                <p className="font-medium text-red-400">
                  −{formatLKR(currentPeriod.charges?.totalCharges || 0)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Earnings by category */}
        {breakdown.byCategory.length > 0 && (
          <div className="glass-card rounded-xl p-4">
            <h2 className="font-semibold mb-3">Earnings by Category (last 30 days)</h2>
            <div className="space-y-2">
              {breakdown.byCategory.map((row, index) => (
                <div
                  key={row.category || `uncategorised-${index}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {row.category || 'Uncategorised'}
                  </span>
                  <span className="font-medium">
                    {formatLKR(row.earnings)}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({row.orders} order{row.orders === 1 ? '' : 's'})
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settlement history */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="p-4 border-b border-border/40 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <h2 className="font-semibold">Settlement History</h2>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44 bg-secondary/50">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="glass-card">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : settlements.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No settlements yet</p>
              <p className="text-xs mt-1">
                Settlements are generated once your completed orders are reconciled.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Period</th>
                    <th className="px-4 py-3 text-right font-medium hidden sm:table-cell">Orders</th>
                    <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Gross</th>
                    <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Commission</th>
                    <th className="px-4 py-3 text-right font-medium">Payable</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((settlement) => (
                    <tr
                      key={settlement._id}
                      className="border-t border-border/40 hover:bg-secondary/20"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{formatPeriod(settlement)}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">
                          {settlement.ordersSummary?.totalOrders ?? 0} orders
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell">
                        {settlement.ordersSummary?.totalOrders ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        {formatLKR(settlement.ordersSummary?.totalOrderAmount || 0)}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell text-red-400">
                        −{formatLKR(settlement.commission?.totalCommission || 0)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-primary">
                        {formatLKR(settlement.payableAmount || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 rounded-md border text-xs ${
                            statusColorMap[settlement.status] || statusColorMap.cancelled
                          }`}
                        >
                          {titleCase(settlement.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelected(settlement)}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="glass-card max-w-lg">
          <DialogHeader>
            <DialogTitle>Settlement Details</DialogTitle>
            <DialogDescription>
              {selected ? formatPeriod(selected) : ''}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Gross sales</span>
                  <span>{formatLKR(selected.ordersSummary?.totalOrderAmount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Refunded</span>
                  <span className="text-red-400">
                    −{formatLKR(selected.ordersSummary?.totalRefunded || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Net sales</span>
                  <span>{formatLKR(selected.ordersSummary?.netOrderAmount || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Commission ({selected.commission?.rate ?? 0}%)
                  </span>
                  <span className="text-red-400">
                    −{formatLKR(selected.commission?.totalCommission || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform fee</span>
                  <span className="text-red-400">
                    −{formatLKR(selected.charges?.platformFee || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment processing</span>
                  <span className="text-red-400">
                    −{formatLKR(selected.charges?.paymentProcessingFee || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Logistics</span>
                  <span className="text-red-400">
                    −{formatLKR(selected.charges?.logisticsFee || 0)}
                  </span>
                </div>
              </div>

              <div className="border-t border-border/40 pt-3 flex justify-between items-center">
                <span className="font-semibold">Payable to you</span>
                <span className="font-display text-xl font-bold text-primary">
                  {formatLKR(selected.payableAmount || 0)}
                </span>
              </div>

              <div className="border-t border-border/40 pt-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span>{titleCase(selected.status)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span>{titleCase(selected.payoutMethod) || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paid on</span>
                  <span>{formatDate(selected.payoutDetails?.payoutDate)}</span>
                </div>
                {selected.payoutDetails?.referenceNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reference</span>
                    <span className="font-mono text-xs">
                      {selected.payoutDetails.referenceNumber}
                    </span>
                  </div>
                )}
                {selected.payoutDetails?.failureReason && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Failure reason</span>
                    <span className="text-red-400">
                      {selected.payoutDetails.failureReason}
                    </span>
                  </div>
                )}
                {selected.notes && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p>{selected.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default Payouts;
