import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Filter, Loader2, Search, Truck, XCircle } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api, ApiRefund } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const statusColorMap: Record<string, string> = {
  requested: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  refund_processing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  refund_completed: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const returnStatusColorMap: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  picked: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  received: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  not_required: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const titleCase = (value?: string) =>
  String(value || '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const AdminRefunds: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refunds, setRefunds] = useState<ApiRefund[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [returnStatusFilter, setReturnStatusFilter] = useState<string>('all');

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminRefunds({
        page: 1,
        limit: 100,
        status: statusFilter === 'all' ? undefined : statusFilter,
        returnStatus: returnStatusFilter === 'all' ? undefined : (returnStatusFilter as 'pending' | 'picked' | 'received' | 'not_required'),
      });
      setRefunds(data.refunds || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load refunds',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRefunds();
  }, [statusFilter, returnStatusFilter]);

  const filteredRefunds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return refunds;

    return refunds.filter((refund) => {
      const requestNumber = String(refund.requestNumber || '').toLowerCase();
      const orderId = String((refund as any).order?._id || refund.order || '').toLowerCase();
      const customer = String((refund as any).customer?.email || (refund as any).customer?.name || '').toLowerCase();
      const product = String(refund.product?.name || '').toLowerCase();
      return requestNumber.includes(q) || orderId.includes(q) || customer.includes(q) || product.includes(q);
    });
  }, [refunds, search]);

  const handleApproveReject = async (refundId: string, status: 'Approved' | 'Rejected') => {
    setActionLoading(`${refundId}-${status}`);
    try {
      await api.approveOrRejectRefund(refundId, { status });
      toast({ title: 'Updated', description: `Refund ${status.toLowerCase()}` });
      await fetchRefunds();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update refund', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReturnStatus = async (
    refundId: string,
    returnStatus: 'pending' | 'picked' | 'received' | 'not_required'
  ) => {
    setActionLoading(`${refundId}-return-${returnStatus}`);
    try {
      await api.updateRefundReturnStatus(refundId, returnStatus);
      toast({ title: 'Updated', description: `Return status set to ${titleCase(returnStatus)}` });
      await fetchRefunds();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update return status', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Refund Review</h1>
          <p className="text-muted-foreground mt-1">
            Approve/reject refund requests and advance return status from pickup to warehouse received.
          </p>
        </div>

        <Card className="glass-card p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by request, customer, order, product..."
                className="pl-9 bg-secondary/50"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44 bg-secondary/50">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Refund status" />
              </SelectTrigger>
              <SelectContent className="glass-card">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="requested">Requested</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="refund_processing">Refund Processing</SelectItem>
                <SelectItem value="refund_completed">Refund Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={returnStatusFilter} onValueChange={setReturnStatusFilter}>
              <SelectTrigger className="w-full sm:w-44 bg-secondary/50">
                <Truck className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Return status" />
              </SelectTrigger>
              <SelectContent className="glass-card">
                <SelectItem value="all">All Return Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="picked">Picked</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="not_required">Not Required</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="glass-card overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Request</TableHead>
                  <TableHead className="hidden md:table-cell">Order</TableHead>
                  <TableHead className="hidden lg:table-cell">Customer</TableHead>
                  <TableHead>Refund Status</TableHead>
                  <TableHead>Return Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRefunds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No refund requests found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRefunds.map((refund, index) => {
                    const id = String(refund._id || refund.id || `refund-${index}`);
                    const status = String(refund.status || 'requested');
                    const returnStatus = String(refund.returnStatus || 'pending');
                    const canReview = status === 'requested';
                    const canMoveReturn = status === 'approved' && ['pending', 'picked'].includes(returnStatus);

                    return (
                      <TableRow key={id} className="border-border/50">
                        <TableCell>
                          <div>
                            <p className="font-medium">{refund.requestNumber || id.slice(0, 8)}</p>
                            <p className="text-xs text-muted-foreground">{refund.product?.name || 'Order refund'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-mono text-xs">
                          {String((refund as any).order?.orderNumber || (refund as any).order?._id || refund.order || '-').slice(0, 18)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {(refund as any).customer?.email || (refund as any).customer?.name || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColorMap[status] || 'bg-muted/40'}>
                            {titleCase(status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={returnStatusColorMap[returnStatus] || 'bg-muted/40'}>
                            {titleCase(returnStatus)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            {canReview && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-emerald-400 border-emerald-500/30"
                                  onClick={() => handleApproveReject(id, 'Approved')}
                                  disabled={Boolean(actionLoading)}
                                >
                                  {actionLoading === `${id}-Approved` ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-1" />Approve
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-400 border-red-500/30"
                                  onClick={() => handleApproveReject(id, 'Rejected')}
                                  disabled={Boolean(actionLoading)}
                                >
                                  {actionLoading === `${id}-Rejected` ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <XCircle className="h-4 w-4 mr-1" />Reject
                                    </>
                                  )}
                                </Button>
                              </>
                            )}

                            {canMoveReturn && (
                              <Select
                                onValueChange={(value) =>
                                  handleReturnStatus(id, value as 'pending' | 'picked' | 'received' | 'not_required')
                                }
                              >
                                <SelectTrigger className="w-40 h-8 bg-secondary/50">
                                  <SelectValue placeholder="Advance Return" />
                                </SelectTrigger>
                                <SelectContent className="glass-card">
                                  {returnStatus === 'pending' && <SelectItem value="picked">Mark Picked</SelectItem>}
                                  {returnStatus === 'picked' && <SelectItem value="received">Mark Received</SelectItem>}
                                  <SelectItem value="not_required">No Return Needed</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </motion.div>
    </AdminLayout>
  );
};

export default AdminRefunds;
