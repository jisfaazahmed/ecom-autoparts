import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  Package,
  Search,
  Truck,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api, ApiShipmentTracking } from '@/lib/api';

interface TrackingTimelineItem {
  event: string;
  title: string;
  description?: string;
  createdAt: string;
}

/**
 * The public tracking payload is deliberately PII-free: city/district only, no
 * recipient name, phone, street address, or proof-of-delivery. Signed-in users
 * get the full record via /shipments.
 */
interface TrackedOrder {
  _id?: string;
  orderNumber?: string;
  overallStatus?: string;
  estimatedDeliveryDate?: string;
  trackingNumber?: string;
  destination?: { city?: string; district?: string };
  items?: Array<{ _id?: string; status?: string; quantity?: number }>;
}

interface TrackingResponse {
  order: TrackedOrder;
  timeline: TrackingTimelineItem[];
}

const statusStyles: Record<string, { icon: React.ReactNode; label: string }> = {
  pending: { icon: <Clock className="h-4 w-4" />, label: 'Pending' },
  confirmed: { icon: <CheckCircle className="h-4 w-4" />, label: 'Confirmed' },
  processing: { icon: <Package className="h-4 w-4" />, label: 'Processing' },
  ready_to_ship: { icon: <Package className="h-4 w-4" />, label: 'Ready to Ship' },
  shipped: { icon: <Truck className="h-4 w-4" />, label: 'Shipped' },
  out_for_delivery: { icon: <Truck className="h-4 w-4" />, label: 'Out for Delivery' },
  delivered: { icon: <CheckCircle className="h-4 w-4" />, label: 'Delivered' },
  cancelled: { icon: <AlertCircle className="h-4 w-4" />, label: 'Cancelled' },
  return_requested: { icon: <AlertCircle className="h-4 w-4" />, label: 'Return Requested' },
  returned: { icon: <AlertCircle className="h-4 w-4" />, label: 'Returned' },
  refunded: { icon: <AlertCircle className="h-4 w-4" />, label: 'Refunded' },
};

const formatDestination = (destination?: { city?: string; district?: string }) =>
  [destination?.city, destination?.district].filter(Boolean).join(', ');

const formatDateTime = (value?: string) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const TrackOrder: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTracking = searchParams.get('tracking') || '';

  const [trackingNumber, setTrackingNumber] = useState(initialTracking);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackingResponse | null>(null);
  const [shipment, setShipment] = useState<ApiShipmentTracking | null>(null);
  const [initialized, setInitialized] = useState(false);

  const status = useMemo(() => {
    const rawStatus = result?.order?.overallStatus || 'pending';
    return statusStyles[rawStatus] || statusStyles.pending;
  }, [result]);

  useEffect(() => {
    if (initialized || !initialTracking) return;
    setInitialized(true);
    void handleLookup(initialTracking);
  }, [initialized, initialTracking]);

  const handleLookup = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Enter a tracking number to continue.');
      setResult(null);
      return;
    }

    const trackingRegex = /^[A-Za-z0-9-]{4,64}$/;
    if (!trackingRegex.test(trimmed)) {
      setError('Tracking number format is invalid. Use letters, numbers, or hyphens only.');
      setResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Order lookup is the source of truth; the shipment leg adds courier scans
      // and is best-effort so tracking still works before a shipment exists.
      const [orderResult, shipmentResult] = await Promise.allSettled([
        api.trackOrder(trimmed),
        api.trackShipment(trimmed),
      ]);

      if (orderResult.status === 'rejected' && shipmentResult.status === 'rejected') {
        throw new Error('not found');
      }

      setResult(orderResult.status === 'fulfilled' ? orderResult.value : null);
      setShipment(shipmentResult.status === 'fulfilled' ? shipmentResult.value : null);
      setSearchParams({ tracking: trimmed });
    } catch (err) {
      setResult(null);
      setShipment(null);
      setError('No order found for this tracking number.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedTracking = String(formData.get('trackingNumber') ?? trackingNumber);
    void handleLookup(submittedTracking);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container py-10">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-display font-bold">Track Your Order</h1>
            <p className="text-muted-foreground mt-2">
              Enter a tracking number to view the latest shipment status and timeline.
            </p>
          </motion.div>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Tracking Lookup</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    name="trackingNumber"
                    value={trackingNumber}
                    onChange={(event) => setTrackingNumber(event.target.value)}
                    placeholder="Enter tracking number"
                    className="pl-9"
                  />
                </div>
                <Button type="submit" disabled={loading} className="sm:w-36">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Track'}
                </Button>
              </form>
              {error && (
                <div className="mt-4 text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {(result || shipment) && !loading && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="glass-card mt-6">
                <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Order</p>
                    <h2 className="text-xl font-semibold">
                      #{result?.order.orderNumber || trackingNumber}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 text-primary">
                    {status.icon}
                    <span className="font-medium">{status.label}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Tracking Number</p>
                      <p className="font-medium">
                        {shipment?.trackingNumber || result?.order.trackingNumber || trackingNumber}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {shipment?.deliveredAt ? 'Delivered' : 'Estimated Delivery'}
                      </p>
                      <p className="font-medium">
                        {formatDateTime(
                          shipment?.deliveredAt
                            || shipment?.estimatedDelivery
                            || result?.order.estimatedDeliveryDate
                        )}
                      </p>
                    </div>
                    {shipment?.courier && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Courier</p>
                        <p className="font-medium capitalize">{shipment.courier}</p>
                      </div>
                    )}
                    {shipment?.currentLocation?.city && (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Last Seen</p>
                        <p className="font-medium">
                          {formatDestination(shipment.currentLocation)}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Delivering To</p>
                      <p className="font-medium">
                        {formatDestination(shipment?.destination || result?.order.destination)
                          || 'Destination not available'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Sign in to view the full delivery address.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {shipment && shipment.trackingEvents.length > 0 && (
                <Card className="glass-card mt-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Courier Scans</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {shipment.trackingEvents.map((event, index) => (
                        <div key={`scan-${index}`} className="flex gap-3">
                          <div className="h-2.5 w-2.5 rounded-full bg-primary mt-2" />
                          <div>
                            <p className="font-medium capitalize">
                              {String(event.status || '').replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(event.timestamp)}
                              {event.location?.city ? ` · ${formatDestination(event.location)}` : ''}
                            </p>
                            {event.description && (
                              <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {result && (
                <Card className="glass-card mt-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Order Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {result.timeline.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No tracking updates yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {result.timeline.map((event, index) => (
                          <div key={`${event.event}-${index}`} className="flex gap-3">
                            <div className="h-2.5 w-2.5 rounded-full bg-primary mt-2" />
                            <div>
                              <p className="font-medium">{event.title}</p>
                              <p className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</p>
                              {event.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {event.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TrackOrder;
