import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle,
  FileText,
  Loader2,
  MapPin,
  PackageCheck,
  Search,
  Truck,
} from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { api, ApiShipment, ShipmentStatus } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  label_created: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  pickup_scheduled: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  picked_up: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_transit: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  out_for_delivery: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  delivered: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  returned_to_sender: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  on_hold: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  lost: 'bg-red-500/20 text-red-400 border-red-500/30',
  damaged: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// Mirrors isValidStatusTransition in server/services/shipping.service.js.
// Keeping this in sync means the UI only offers moves the API will accept.
const allowedTransitions: Record<string, ShipmentStatus[]> = {
  label_created: ['pickup_scheduled', 'picked_up', 'cancelled', 'on_hold'],
  pickup_scheduled: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'cancelled', 'on_hold'],
  in_transit: ['out_for_delivery', 'failed', 'lost', 'damaged', 'on_hold'],
  out_for_delivery: ['delivered', 'failed', 'on_hold'],
  failed: ['out_for_delivery', 'returned_to_sender', 'cancelled'],
  on_hold: ['in_transit', 'out_for_delivery', 'cancelled'],
  delivered: [],
  returned_to_sender: [],
  lost: [],
  damaged: [],
  cancelled: [],
};

const titleCase = (value?: string) =>
  String(value || '')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const orderNumberOf = (shipment: ApiShipment) =>
  typeof shipment.order === 'object' ? shipment.order?.orderNumber : undefined;

const AdminShipments: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shipments, setShipments] = useState<ApiShipment[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [statusDialog, setStatusDialog] = useState<ApiShipment | null>(null);
  const [nextStatus, setNextStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState('');
  const [statusCity, setStatusCity] = useState('');

  const [pickupDialog, setPickupDialog] = useState<ApiShipment | null>(null);
  const [pickupDate, setPickupDate] = useState('');

  const [deliveryDialog, setDeliveryDialog] = useState<ApiShipment | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientRelation, setRecipientRelation] = useState('self');
  const [deliveryAgentName, setDeliveryAgentName] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  const [attemptDialog, setAttemptDialog] = useState<ApiShipment | null>(null);
  const [attemptStatus, setAttemptStatus] = useState('customer_not_available');
  const [attemptReason, setAttemptReason] = useState('');

  const loadShipments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getVendorShipments({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 100,
      });
      setShipments(result.shipments || []);
    } catch (error) {
      toast({
        title: 'Could not load shipments',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    void loadShipments();
  }, [loadShipments]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return shipments;

    return shipments.filter((shipment) =>
      [shipment.trackingNumber, orderNumberOf(shipment), shipment.shippingAddress?.city]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(query))
    );
  }, [shipments, search]);

  const runAction = async (id: string, action: () => Promise<unknown>, successMessage: string) => {
    setBusyId(id);
    try {
      await action();
      toast({ title: successMessage });
      await loadShipments();
      return true;
    } catch (error) {
      toast({
        title: 'Action failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateStatus = async () => {
    if (!statusDialog || !nextStatus) return;

    const ok = await runAction(
      statusDialog._id,
      () =>
        api.updateShipmentStatus(statusDialog._id, {
          status: nextStatus,
          note: statusNote.trim() || undefined,
          location: statusCity.trim() ? { city: statusCity.trim() } : undefined,
        }),
      `Shipment marked ${titleCase(nextStatus)}`
    );

    if (ok) {
      setStatusDialog(null);
      setNextStatus('');
      setStatusNote('');
      setStatusCity('');
    }
  };

  const handleSchedulePickup = async () => {
    if (!pickupDialog || !pickupDate) return;

    const ok = await runAction(
      pickupDialog._id,
      () =>
        api.scheduleShipmentPickup(pickupDialog._id, {
          pickupDate: new Date(pickupDate).toISOString(),
          pickupAddress: {
            district: pickupDialog.shippingAddress?.district || '',
            city: pickupDialog.shippingAddress?.city || '',
          },
        }),
      'Pickup scheduled'
    );

    if (ok) {
      setPickupDialog(null);
      setPickupDate('');
    }
  };

  const handleConfirmDelivery = async () => {
    if (!deliveryDialog || !recipientName.trim()) return;

    const ok = await runAction(
      deliveryDialog._id,
      () =>
        api.confirmShipmentDelivery(deliveryDialog._id, {
          recipientName: recipientName.trim(),
          recipientRelation,
          notes: deliveryNotes.trim() || undefined,
          deliveryAgent: deliveryAgentName.trim() ? { name: deliveryAgentName.trim() } : undefined,
        }),
      'Delivery confirmed'
    );

    if (ok) {
      setDeliveryDialog(null);
      setRecipientName('');
      setDeliveryAgentName('');
      setDeliveryNotes('');
    }
  };

  const handleRecordAttempt = async () => {
    if (!attemptDialog) return;

    const ok = await runAction(
      attemptDialog._id,
      () =>
        api.recordDeliveryAttempt(attemptDialog._id, {
          status: attemptStatus,
          reason: attemptReason.trim() || undefined,
        }),
      'Delivery attempt recorded'
    );

    if (ok) {
      setAttemptDialog(null);
      setAttemptReason('');
    }
  };

  const handleGenerateLabel = (shipment: ApiShipment) =>
    runAction(
      shipment._id,
      () => api.generateShippingLabel(shipment._id),
      'Shipping label generated'
    );

  const openStatusDialog = (shipment: ApiShipment) => {
    setStatusDialog(shipment);
    setNextStatus(allowedTransitions[shipment.status]?.[0] || '');
    setStatusNote('');
    setStatusCity('');
  };

  return (
    <AdminLayout>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Truck className="h-7 w-7 text-primary" />
            Shipments
          </h1>
          <p className="text-muted-foreground">
            Shipments are created automatically when an order item is marked ready to ship.
          </p>
        </div>

        <Card className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tracking number, order, or city"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.keys(allowedTransitions).map((status) => (
                  <SelectItem key={status} value={status}>
                    {titleCase(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <PackageCheck className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p>No shipments yet.</p>
              <p className="text-sm">Mark an order item as ready to ship to create one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Est. Delivery</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((shipment) => {
                    const busy = busyId === shipment._id;
                    const transitions = allowedTransitions[shipment.status] || [];

                    return (
                      <TableRow key={shipment._id}>
                        <TableCell className="font-mono text-xs">{shipment.trackingNumber}</TableCell>
                        <TableCell>{orderNumberOf(shipment) || '—'}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-sm">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            {shipment.shippingAddress?.city || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={statusColorMap[shipment.status]}>
                            {titleCase(shipment.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(shipment.estimatedDeliveryDate)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-2">
                            {busy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}

                            {shipment.status === 'label_created' && (
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => setPickupDialog(shipment)}>
                                <CalendarClock className="mr-1 h-3.5 w-3.5" />
                                Pickup
                              </Button>
                            )}

                            {transitions.length > 0 && (
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => openStatusDialog(shipment)}>
                                <Truck className="mr-1 h-3.5 w-3.5" />
                                Status
                              </Button>
                            )}

                            {shipment.status === 'out_for_delivery' && (
                              <>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => setAttemptDialog(shipment)}>
                                  <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                                  Attempt
                                </Button>
                                <Button size="sm" disabled={busy} onClick={() => setDeliveryDialog(shipment)}>
                                  <CheckCircle className="mr-1 h-3.5 w-3.5" />
                                  Delivered
                                </Button>
                              </>
                            )}

                            <Button size="sm" variant="ghost" disabled={busy} onClick={() => handleGenerateLabel(shipment)}>
                              <FileText className="mr-1 h-3.5 w-3.5" />
                              Label
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Update status */}
      <Dialog open={!!statusDialog} onOpenChange={(open) => !open && setStatusDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Shipment Status</DialogTitle>
            <DialogDescription>
              {statusDialog?.trackingNumber} — currently {titleCase(statusDialog?.status)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New status</Label>
              <Select value={nextStatus} onValueChange={setNextStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  {(allowedTransitions[statusDialog?.status || ''] || []).map((status) => (
                    <SelectItem key={status} value={status}>
                      {titleCase(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-city">Current city (optional)</Label>
              <Input
                id="status-city"
                value={statusCity}
                onChange={(event) => setStatusCity(event.target.value)}
                placeholder="e.g. Kandy"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status-note">Note (optional)</Label>
              <Textarea
                id="status-note"
                value={statusNote}
                onChange={(event) => setStatusNote(event.target.value)}
                placeholder="Visible on the customer's tracking timeline"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog(null)}>Cancel</Button>
            <Button onClick={handleUpdateStatus} disabled={!nextStatus || busyId === statusDialog?._id}>
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule pickup */}
      <Dialog open={!!pickupDialog} onOpenChange={(open) => !open && setPickupDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Pickup</DialogTitle>
            <DialogDescription>{pickupDialog?.trackingNumber}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="pickup-date">Pickup date</Label>
            <Input
              id="pickup-date"
              type="date"
              value={pickupDate}
              onChange={(event) => setPickupDate(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickupDialog(null)}>Cancel</Button>
            <Button onClick={handleSchedulePickup} disabled={!pickupDate || busyId === pickupDialog?._id}>
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delivery */}
      <Dialog open={!!deliveryDialog} onOpenChange={(open) => !open && setDeliveryDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delivery</DialogTitle>
            <DialogDescription>{deliveryDialog?.trackingNumber}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipient-name">Received by</Label>
              <Input
                id="recipient-name"
                value={recipientName}
                onChange={(event) => setRecipientName(event.target.value)}
                placeholder="Recipient name"
              />
            </div>

            <div className="space-y-2">
              <Label>Relationship</Label>
              <Select value={recipientRelation} onValueChange={setRecipientRelation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['self', 'family', 'friend', 'security', 'neighbor', 'office_staff'].map((value) => (
                    <SelectItem key={value} value={value}>
                      {titleCase(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-name">Delivery agent (optional)</Label>
              <Input
                id="agent-name"
                value={deliveryAgentName}
                onChange={(event) => setDeliveryAgentName(event.target.value)}
                placeholder="Agent name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery-notes">Notes (optional)</Label>
              <Textarea
                id="delivery-notes"
                value={deliveryNotes}
                onChange={(event) => setDeliveryNotes(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeliveryDialog(null)}>Cancel</Button>
            <Button onClick={handleConfirmDelivery} disabled={!recipientName.trim() || busyId === deliveryDialog?._id}>
              Confirm Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery attempt */}
      <Dialog open={!!attemptDialog} onOpenChange={(open) => !open && setAttemptDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Delivery Attempt</DialogTitle>
            <DialogDescription>{attemptDialog?.trackingNumber}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Outcome</Label>
              <Select value={attemptStatus} onValueChange={setAttemptStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['customer_not_available', 'wrong_address', 'rescheduled', 'failed'].map((value) => (
                    <SelectItem key={value} value={value}>
                      {titleCase(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="attempt-reason">Reason (optional)</Label>
              <Textarea
                id="attempt-reason"
                value={attemptReason}
                onChange={(event) => setAttemptReason(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAttemptDialog(null)}>Cancel</Button>
            <Button onClick={handleRecordAttempt} disabled={busyId === attemptDialog?._id}>
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminShipments;
