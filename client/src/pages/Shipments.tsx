import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Loader2,
  MapPin,
  Package,
  Star,
  Truck,
} from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import { api, ApiShipment } from '@/lib/api';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

const statusColorMap: Record<string, string> = {
  label_created: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  pickup_scheduled: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  picked_up: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_transit: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  out_for_delivery: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  delivered: 'bg-green-500/20 text-green-400 border-green-500/30',
  failed: 'bg-red-500/20 text-red-400 border-red-500/30',
  on_hold: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
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

const StarPicker: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({
  label,
  value,
  onChange,
}) => (
  <div className="flex items-center justify-between">
    <Label>{label}</Label>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((score) => (
        <button
          key={score}
          type="button"
          aria-label={`${label}: ${score} of 5`}
          onClick={() => onChange(score)}
          className="p-0.5"
        >
          <Star
            className={`h-5 w-5 transition-colors ${
              score <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'
            }`}
          />
        </button>
      ))}
    </div>
  </div>
);

const Shipments: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [shipments, setShipments] = useState<ApiShipment[]>([]);

  const [ratingFor, setRatingFor] = useState<ApiShipment | null>(null);
  const [deliverySpeed, setDeliverySpeed] = useState(5);
  const [courierBehavior, setCourierBehavior] = useState(5);
  const [packaging, setPackaging] = useState(5);
  const [feedback, setFeedback] = useState('');

  const [issueFor, setIssueFor] = useState<ApiShipment | null>(null);
  const [issueType, setIssueType] = useState('delay');
  const [issueSeverity, setIssueSeverity] = useState('medium');
  const [issueDescription, setIssueDescription] = useState('');

  const loadShipments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getCustomerShipments({ limit: 50 });
      setShipments(result.shipments || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load your shipments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadShipments();
  }, [loadShipments]);

  const handleSubmitRating = async () => {
    if (!ratingFor) return;

    setBusy(true);
    try {
      await api.submitShipmentRating(ratingFor._id, {
        deliverySpeed,
        courierBehavior,
        packaging,
        feedback: feedback.trim() || undefined,
      });
      toast.success('Thanks for rating this delivery');
      setRatingFor(null);
      setFeedback('');
      await loadShipments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit rating');
    } finally {
      setBusy(false);
    }
  };

  const handleReportIssue = async () => {
    if (!issueFor || !issueDescription.trim()) return;

    setBusy(true);
    try {
      await api.reportShipmentIssue(issueFor._id, {
        type: issueType,
        severity: issueSeverity,
        description: issueDescription.trim(),
      });
      toast.success('Issue reported. Our team will follow up.');
      setIssueFor(null);
      setIssueDescription('');
      await loadShipments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not report issue');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container py-10">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Truck className="h-7 w-7 text-primary" />
            My Shipments
          </h1>
          <p className="text-muted-foreground mt-2">
            Track deliveries, rate your courier, and report any problems.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : shipments.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-16 text-center text-muted-foreground">
              <Package className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p>No shipments yet.</p>
              <p className="text-sm">Shipments appear here once a seller dispatches your order.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/orders">View my orders</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {shipments.map((shipment) => {
              const isDelivered = shipment.status === 'delivered';
              const alreadyRated = Boolean(shipment.rating?.ratedAt);

              return (
                <Card key={shipment._id} className="glass-card">
                  <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <CardTitle className="text-base font-mono">{shipment.trackingNumber}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {typeof shipment.order === 'object' && shipment.order?.orderNumber
                          ? `Order #${shipment.order.orderNumber}`
                          : 'Order'}
                        {shipment.courierPartner?.name ? ` · via ${titleCase(shipment.courierPartner.name)}` : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className={statusColorMap[shipment.status]}>
                      {titleCase(shipment.status)}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Destination</p>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {shipment.shippingAddress?.city || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {isDelivered ? 'Delivered' : 'Estimated delivery'}
                        </p>
                        <p className="text-sm font-medium">
                          {formatDate(isDelivered ? shipment.actualDeliveryDate : shipment.estimatedDeliveryDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Delivery attempts</p>
                        <p className="text-sm font-medium">{shipment.deliveryAttempts?.length ?? 0}</p>
                      </div>
                    </div>

                    {shipment.rating?.overall ? (
                      <div className="flex items-center gap-2 text-sm">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                        <span>You rated this delivery {shipment.rating.overall}/5</span>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/track-order?tracking=${encodeURIComponent(shipment.trackingNumber)}`}>
                          Track
                        </Link>
                      </Button>

                      {isDelivered && !alreadyRated && (
                        <Button size="sm" variant="outline" onClick={() => setRatingFor(shipment)}>
                          <Star className="mr-1 h-3.5 w-3.5" />
                          Rate delivery
                        </Button>
                      )}

                      <Button size="sm" variant="ghost" onClick={() => setIssueFor(shipment)}>
                        <AlertCircle className="mr-1 h-3.5 w-3.5" />
                        Report an issue
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Rate delivery */}
      <Dialog open={!!ratingFor} onOpenChange={(open) => !open && setRatingFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate this delivery</DialogTitle>
            <DialogDescription>{ratingFor?.trackingNumber}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <StarPicker label="Delivery speed" value={deliverySpeed} onChange={setDeliverySpeed} />
            <StarPicker label="Courier behaviour" value={courierBehavior} onChange={setCourierBehavior} />
            <StarPicker label="Packaging" value={packaging} onChange={setPackaging} />

            <div className="space-y-2">
              <Label htmlFor="rating-feedback">Feedback (optional)</Label>
              <Textarea
                id="rating-feedback"
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="Anything the courier did well or could improve?"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRatingFor(null)}>Cancel</Button>
            <Button onClick={handleSubmitRating} disabled={busy}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit rating
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report issue */}
      <Dialog open={!!issueFor} onOpenChange={(open) => !open && setIssueFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report a delivery issue</DialogTitle>
            <DialogDescription>{issueFor?.trackingNumber}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Issue type</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['delay', 'damage', 'lost', 'wrong_address', 'other'].map((value) => (
                    <SelectItem key={value} value={value}>
                      {titleCase(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={issueSeverity} onValueChange={setIssueSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['low', 'medium', 'high', 'critical'].map((value) => (
                    <SelectItem key={value} value={value}>
                      {titleCase(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue-description">What happened?</Label>
              <Textarea
                id="issue-description"
                value={issueDescription}
                onChange={(event) => setIssueDescription(event.target.value)}
                placeholder="Describe the problem"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueFor(null)}>Cancel</Button>
            <Button onClick={handleReportIssue} disabled={busy || !issueDescription.trim()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Report issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Shipments;
