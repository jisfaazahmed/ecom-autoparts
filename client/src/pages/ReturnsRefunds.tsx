import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, RotateCcw, Search, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import RefundForm from '@/components/orders/RefundForm';
import type { RefundFormSubmission } from '@/components/orders/RefundForm';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiOrderItem, ApiRefund } from '@/lib/api';
import { formatLKR } from '@/lib/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type RefundableItem = {
  orderId: string;
  orderNumber: string;
  item: ApiOrderItem;
  deliveredAt?: string;
};

type OrderReference = {
  id: string;
  orderNumber: string;
};

const reasonOptions = [
  { value: 'defective_product', label: 'Defective Product' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'not_as_described', label: 'Not as Described' },
  { value: 'damaged_in_transit', label: 'Damaged in Transit' },
  { value: 'missing_parts', label: 'Missing Parts' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'changed_mind', label: 'Changed Mind' },
  { value: 'other', label: 'Other' },
];

const statusColorMap: Record<string, string> = {
  requested: 'bg-primary/20 text-primary border-primary/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  pickup_scheduled: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  picked_up: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  in_transit: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  received_at_warehouse: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  refund_processing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  refund_completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  disputed: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const normalizeStatusLabel = (status?: string) =>
  String(status || 'requested')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const ReturnsRefunds: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [refunds, setRefunds] = useState<ApiRefund[]>([]);
  const [items, setItems] = useState<RefundableItem[]>([]);
  const [orderRefs, setOrderRefs] = useState<OrderReference[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RefundableItem | null>(null);

  const [orderId, setOrderId] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const orderFetcher = user?.role === 'admin' || user?.role === 'seller'
        ? api.getVendorOrders({ page: 1, limit: 100 })
        : api.getOrders({ page: 1, limit: 100 });

      const [ordersResult, refundsResult] = await Promise.allSettled([
        orderFetcher,
        api.getCustomerRefunds({ page: 1, limit: 50 }),
      ]);

      const orders = ordersResult.status === 'fulfilled' ? ordersResult.value.data || [] : [];
      const refunds = refundsResult.status === 'fulfilled' ? refundsResult.value.refunds || [] : [];

      if (ordersResult.status === 'rejected') {
        console.warn('Failed to load orders for returns page:', ordersResult.reason);
        toast.error('Order list could not be loaded right now. You can still submit a manual return request.');
      }

      if (refundsResult.status === 'rejected') {
        console.warn('Failed to load refund requests:', refundsResult.reason);
      }

      const refundableStatuses = new Set(['delivered']);
      const blockedItemStatuses = new Set([
        'return_requested',
        'returned',
        'refunded',
        'cancelled',
      ]);

      const mappedItems: RefundableItem[] = [];
      const mappedOrderRefs: OrderReference[] = [];
      for (const order of orders) {
        const currentOrderId = String(order.id || order._id || '');
        const currentOrderNumber = String(order.orderNumber || currentOrderId.slice(0, 8));

        if (currentOrderId) {
          mappedOrderRefs.push({
            id: currentOrderId,
            orderNumber: currentOrderNumber,
          });
        }

        const orderStatus = String(order.overallStatus || order.status || '').toLowerCase();
        const canRequestByOrder = refundableStatuses.has(orderStatus);

        for (const item of order.items || []) {
          const itemStatus = String(item.status || orderStatus || '').toLowerCase();
          const canRequestByItem = itemStatus === 'delivered' || (canRequestByOrder && !blockedItemStatuses.has(itemStatus));

          if (!canRequestByItem) {
            continue;
          }

          mappedItems.push({
            orderId: currentOrderId,
            orderNumber: currentOrderNumber,
            item,
            deliveredAt: order.updatedAt,
          });
        }
      }

      setOrderRefs(mappedOrderRefs);
      setItems(mappedItems);
      setRefunds(refunds);
    } catch (error) {
      console.error('Failed to load returns data:', error);
      toast.error('Failed to load returns and refunds');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const prefOrderId = searchParams.get('orderId');
    if (prefOrderId && !dialogOpen) {
      setSelectedItem(null);
      setOrderId(prefOrderId);
      setPaymentId('');
      setAmount('');
      setDialogOpen(true);
    }
  }, [location.search]); // Remove dialogOpen from dependencies

  const filteredRefunds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return refunds;

    return refunds.filter((refund) => {
      const requestNumber = String(refund.requestNumber || '').toLowerCase();
      const productName = String(refund.product?.name || '').toLowerCase();
      const status = String(refund.status || '').toLowerCase();

      return requestNumber.includes(q) || productName.includes(q) || status.includes(q);
    });
  }, [refunds, search]);

  const openRequestDialog = (item: RefundableItem) => {
    setSelectedItem(item);
    setOrderId(item.orderId);
    setAmount(String(item.item.totalPrice || item.item.unitPrice * item.item.quantity || 0));
    setPaymentId('');
    setDialogOpen(true);
  };

  const openManualRequestDialog = () => {
    setSelectedItem(null);
    setOrderId('');
    setPaymentId('');
    setAmount('');
    setDialogOpen(true);
  };

  const resolveOrderId = (rawOrderInput: string) => {
    const input = String(rawOrderInput || '').trim();
    if (!input) return '';

    const normalized = input.replace(/^order\s*#?/i, '').trim();
    const normalizedLower = normalized.toLowerCase();

    const refList = orderRefs.length > 0
      ? orderRefs
      : Array.from(
          new Map(
            items
              .filter((entry) => entry.orderId)
              .map((entry) => [entry.orderId, { id: entry.orderId, orderNumber: entry.orderNumber }])
          ).values()
        );

    const directMatch = refList.find((ref) => ref.id.toLowerCase() === input.toLowerCase());
    if (directMatch) return directMatch.id;

    const byOrderNumber = refList.find((ref) => ref.orderNumber.toLowerCase() === normalizedLower);
    if (byOrderNumber) return byOrderNumber.id;

    const byIdPrefix = refList.find((ref) => ref.id.toLowerCase().startsWith(normalizedLower));
    if (byIdPrefix) return byIdPrefix.id;

    const byOrderPrefix = refList.find((ref) => ref.orderNumber.toLowerCase().startsWith(normalizedLower));
    if (byOrderPrefix) return byOrderPrefix.id;

    return input;
  };

  const submitRefundRequest = async (formData: RefundFormSubmission) => {
    if (!orderId.trim()) {
      toast.error('Please enter an order ID');
      return;
    }

    const resolvedOrderId = resolveOrderId(orderId);
    const objectIdRegex = /^[a-f\d]{24}$/i;
    if (!objectIdRegex.test(resolvedOrderId)) {
      toast.error('Please enter a valid order ID (or select an order from the list)');
      return;
    }

    const normalizedAmount = Number(amount);
    if (!amount.trim() || !Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      toast.error('Please enter a valid refund amount');
      return;
    }

    const normalizedPaymentId = paymentId.trim();
    if (normalizedPaymentId) {
      const paymentIdRegex = /^[A-Za-z0-9_-]{4,64}$/;
      if (!paymentIdRegex.test(normalizedPaymentId)) {
        toast.error('Please enter a valid payment ID');
        return;
      }
    }

    setSubmitting(true);
    try {
      await api.createRefundRequestByOrder({
        orderId: resolvedOrderId,
        orderItemId: selectedItem ? String(selectedItem.item._id || selectedItem.item.id || '') : undefined,
        paymentId: normalizedPaymentId || undefined,
        amount: normalizedAmount,
        reason: formData.returnReason.description,
        refundType: 'return',
        details: `Reason: ${formData.returnReason.category}\nCondition: ${formData.productCondition.productState}\nPackaging: ${formData.productCondition.packaging}\nAccessories: ${formData.productCondition.accessories}`,
        returnStatus: 'pending',
      });

      toast.success('Refund request submitted successfully');
      setDialogOpen(false);
      setSelectedItem(null);
      setOrderId('');
      setPaymentId('');
      setAmount('');
      await fetchData();
    } catch (error) {
      console.error('Failed to submit refund request:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8 space-y-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-display font-bold">Returns & Refunds</h1>
          <p className="text-muted-foreground mt-1">
            Request returns for delivered items and track refund progress in one place.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <Card className="glass-card">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-lg">Eligible Items For Return</CardTitle>
                  <Button variant="outline" onClick={openManualRequestDialog}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Request Return / Refund
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      No delivered items are currently eligible for a return request.
                    </p>
                    <div>
                      <Button variant="outline" onClick={openManualRequestDialog}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Create Request Manually
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {items.map((entry) => {
                      const itemId = String(entry.item.id || entry.item._id || `${entry.orderId}-${entry.item.productId}`);
                      return (
                        <div
                          key={itemId}
                          className="rounded-lg border border-border/60 bg-secondary/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        >
                          <div>
                            <p className="font-medium">{entry.item.productName || 'Order item'}</p>
                            <p className="text-sm text-muted-foreground">
                              Order #{entry.orderNumber} • Qty {entry.item.quantity} • {formatLKR(entry.item.totalPrice || 0)}
                            </p>
                          </div>
                          <Button onClick={() => openRequestDialog(entry)}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Request Return
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">My Refund Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by request number, product, or status..."
                    className="pl-9"
                  />
                </div>

                {filteredRefunds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No refund requests found.</p>
                ) : (
                  <div className="space-y-3">
                    {filteredRefunds.map((refund, index) => {
                      const key = String(refund._id || refund.id || `refund-${index}`);
                      const status = String(refund.status || 'requested');
                      return (
                        <div
                          key={key}
                          className="rounded-lg border border-border/60 bg-secondary/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                        >
                          <div>
                            <p className="font-medium">{refund.product?.name || 'Refund request'}</p>
                            <p className="text-sm text-muted-foreground">
                              {refund.requestNumber || key.slice(0, 8)} • {formatLKR(refund.amount || refund.refundAmount?.totalRefund || 0)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Return: {normalizeStatusLabel(refund.returnStatus)}
                              {refund.refundTransactionId ? ` • Ref: ${refund.refundTransactionId}` : ''}
                            </p>
                          </div>
                          <Badge variant="outline" className={statusColorMap[status] || 'bg-muted/40'}>
                            {normalizeStatusLabel(status)}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between">
            <div className="flex-1">
              <DialogTitle>Request Return / Refund</DialogTitle>
              <DialogDescription>
                Follow the steps below to submit your return request. Our team will review it shortly.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-4 mb-4">
            <div>
              <Label className="text-slate-300">Order ID</Label>
              <Input
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                placeholder="Enter order ID or Order #"
                className="bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500"
              />
            </div>

            <div>
              <Label className="text-slate-300">Refund Amount</Label>
              <Input
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="15000"
                className="bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500"
              />
            </div>
          </div>

          <RefundForm
            onSubmit={submitRefundRequest}
            isSubmitting={submitting}
            selectedItem={selectedItem}
          />

          <div className="flex gap-3 pt-4 border-t border-slate-700 mt-4">
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={submitting}
              >
                Cancel
              </Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReturnsRefunds;
