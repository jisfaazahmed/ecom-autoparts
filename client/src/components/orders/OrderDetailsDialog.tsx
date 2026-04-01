import React from 'react';
import { X, Package, Truck, MapPin, Calendar, CreditCard, Phone } from 'lucide-react';
import { ApiOrder } from '@/lib/api';
import { formatLKR } from '@/lib/currency';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface OrderDetailsDialogProps {
  order: ApiOrder | null;
  open: boolean;
  onClose: () => void;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: {
    color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    label: 'Pending',
  },
  processing: {
    color: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    label: 'Processing',
  },
  shipped: {
    color: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    label: 'Shipped',
  },
  delivered: {
    color: 'bg-green-500/20 text-green-500 border-green-500/30',
    label: 'Delivered',
  },
  cancelled: {
    color: 'bg-red-500/20 text-red-500 border-red-500/30',
    label: 'Cancelled',
  },
};

const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({
  order,
  open,
  onClose,
}) => {
  if (!order) return null;

  const status = statusConfig[order.status] || statusConfig.pending;
  const orderId = order.id || order._id || order.orderNumber || '';

  const parseShippingAddress = (shippingAddress: unknown) => {
    if (!shippingAddress || typeof shippingAddress !== 'object') return null;
    const address = shippingAddress as Record<string, unknown>;
    const getString = (value: unknown) =>
      typeof value === 'string' ? value.trim() : '';

    return {
      fullName: getString(address.fullName) || undefined,
      phone: getString(address.phone) || undefined,
      addressLine1: getString(address.addressLine1) || undefined,
      city: getString(address.city) || undefined,
      postalCode: getString(address.postalCode) || undefined,
      country: getString(address.country) || undefined,
      addressType: getString(address.addressType) || undefined,
    };
  };

  const formatAddressLine = (...parts: Array<string | undefined>) =>
    parts.filter(Boolean).join(', ');

  const parsedAddress = parseShippingAddress(order.shippingAddress);
  const contactName = parsedAddress?.fullName || order.customer?.fullName;
  const contactPhone = parsedAddress?.phone || order.customer?.phone;
  const addressLine =
    parsedAddress?.addressLine1 ||
    (typeof order.shippingAddress === 'string' ? order.shippingAddress : '');
  const cityLine = formatAddressLine(
    parsedAddress?.city || order.shippingCity,
    parsedAddress?.postalCode || order.shippingPostalCode,
    parsedAddress?.country
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {orderId
                ? `Order #${orderId.slice(0, 8).toUpperCase()}`
                : 'Order Details'}
            </span>
            <Badge className={status.color}>{status.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Order Date</span>
              </div>
              <p className="text-sm font-medium">
                {new Date(order.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            {order.trackingNumber && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Truck className="h-4 w-4" />
                  <span>Tracking Number</span>
                </div>
                <p className="text-sm font-medium text-primary">
                  {order.trackingNumber}
                </p>
              </div>
            )}
          </div>

          <Separator />

          {/* Shipping Address */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Shipping Address</h3>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-1">
              {contactName && (
                <p className="font-medium">{contactName}</p>
              )}
              {contactPhone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  <span>{contactPhone}</span>
                </div>
              )}
              {addressLine && <p className="text-sm">{addressLine}</p>}
              {cityLine && <p className="text-sm">{cityLine}</p>}
            </div>
          </div>

          <Separator />

          {/* Order Items */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Order Items</h3>
            </div>
            <div className="space-y-3">
              {(order.items || []).map((item) => (
                <div
                  key={item.id}
                  className="flex justify-between items-start bg-muted/50 rounded-lg p-4"
                >
                  <div className="flex-1">
                    <h4 className="font-medium">{item.productName}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Quantity: {item.quantity} × {formatLKR(item.unitPrice)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatLKR(item.totalPrice)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Payment Summary */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Payment Summary</h3>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>
                  {formatLKR(
                    (order.items || []).reduce(
                      (sum, item) => sum + item.totalPrice,
                      0
                    )
                  )}
                </span>
              </div>
              
              {order.discountAmount && order.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-green-500">
                    -{formatLKR(order.discountAmount)}
                  </span>
                </div>
              )}

              <Separator />
              
              <div className="flex justify-between font-semibold text-lg">
                <span>Total</span>
                <span className="text-primary">{formatLKR(order.totalAmount)}</span>
              </div>

              {order.stripePaymentId && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">
                    Payment ID: {order.stripePaymentId}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Order Notes</h3>
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                  {order.notes}
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;
