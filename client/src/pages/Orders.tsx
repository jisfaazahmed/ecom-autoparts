import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Search,
  Filter,
  Eye,
  RotateCcw,
  Ban,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ShoppingCart,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiOrder, ApiOrderTimelineEvent } from '@/lib/api';
import { formatLKR } from '@/lib/currency';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import CancelOrderDialog from '@/components/orders/CancelOrderDialog';
import { useToast } from '@/hooks/use-toast';

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending: {
    icon: <Clock className="h-4 w-4" />,
    color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
    label: 'Pending',
  },
  processing: {
    icon: <Package className="h-4 w-4" />,
    color: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    label: 'Processing',
  },
  ready_to_ship: {
    icon: <Package className="h-4 w-4" />,
    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    label: 'Ready to Ship',
  },
  shipped: {
    icon: <Truck className="h-4 w-4" />,
    color: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    label: 'Shipped',
  },
  out_for_delivery: {
    icon: <Truck className="h-4 w-4" />,
    color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    label: 'Out for Delivery',
  },
  delivered: {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'bg-green-500/20 text-green-500 border-green-500/30',
    label: 'Delivered',
  },
  confirmed: {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
    label: 'Confirmed',
  },
  partially_shipped: {
    icon: <Truck className="h-4 w-4" />,
    color: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    label: 'Partially Shipped',
  },
  partially_delivered: {
    icon: <Truck className="h-4 w-4" />,
    color: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
    label: 'Partially Delivered',
  },
  refunded: {
    icon: <XCircle className="h-4 w-4" />,
    color: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    label: 'Refunded',
  },
  return_requested: {
    icon: <XCircle className="h-4 w-4" />,
    color: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    label: 'Return Requested',
  },
  returned: {
    icon: <XCircle className="h-4 w-4" />,
    color: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    label: 'Returned',
  },
  cancelled: {
    icon: <XCircle className="h-4 w-4" />,
    color: 'bg-red-500/20 text-red-500 border-red-500/30',
    label: 'Cancelled',
  },
};

const getOrderStatus = (order: ApiOrder) =>
  order.overallStatus || order.status || 'pending';

const Orders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null);
  const [selectedOrderTimeline, setSelectedOrderTimeline] = useState<ApiOrderTimelineEvent[]>([]);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
  const [reorderLoading, setReorderLoading] = useState<string | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const ordersPerPage = 10;

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

  const formatShippingAddress = (
    shippingAddress: unknown,
    shippingCity?: string,
    shippingPostalCode?: string
  ) => {
    if (typeof shippingAddress === 'string') {
      return [shippingAddress, shippingCity, shippingPostalCode]
        .filter(Boolean)
        .join(', ');
    }

    const parsed = parseShippingAddress(shippingAddress);
    if (!parsed) return '';

    return [
      parsed.addressLine1,
      parsed.city || shippingCity,
      parsed.postalCode || shippingPostalCode,
      parsed.country,
    ]
      .filter(Boolean)
      .join(', ');
  };

  useEffect(() => {
    fetchOrders();
  }, [user, statusFilter, currentPage]);

  const fetchOrders = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const response = await api.getOrders({
        page: currentPage,
        limit: ordersPerPage,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      
      setOrders(response.data || []);
      setTotalOrders(response.total || 0);
      setTotalPages(response.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast({
        title: 'Error',
        description: 'Failed to load orders. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (order: ApiOrder) => {
    setLoading(true);
    try {
      const orderId = order.id || order._id;
      if (!orderId) {
        setSelectedOrder(order);
        setSelectedOrderTimeline([]);
      } else {
        const details = await api.getOrderWithTimeline(orderId);
        setSelectedOrder(details.order);
        setSelectedOrderTimeline(details.timeline || []);
      }
      setShowDetailsDialog(true);
    } catch (error) {
      setSelectedOrder(order);
      setSelectedOrderTimeline([]);
      setShowDetailsDialog(true);
      toast({
        title: 'Partial Data',
        description: 'Loaded cached order info. Full order timeline is unavailable right now.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (reason: string) => {
    if (!orderToCancel) return;

    try {
      await api.cancelOrder(orderToCancel, reason);
      
      toast({
        title: 'Order Cancelled',
        description: 'Your order has been cancelled successfully.',
      });
      
      // Refresh orders
      await fetchOrders();
    } catch (error) {
      toast({
        title: 'Cancellation Failed',
        description:  'Failed to cancel order. Please try again.',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleReorder = async (orderId: string) => {
    setReorderLoading(orderId);
    try {
      await api.reorder(orderId);
      
      toast({
        title: 'Items Added to Cart',
        description: 'Order items have been added to your cart.',
      });
      
      // Navigate to cart
      navigate('/cart');
    } catch (error) {
      toast({
        title: 'Reorder Failed',
        description: 'Failed to add items to cart. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setReorderLoading(null);
    }
  };

  const handleTrackOrder = (trackingNumber: string) => {
    if (trackingNumber) {
      navigate(`/track-order?tracking=${trackingNumber}`);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return true;

    const normalize = (value: unknown) => {
      if (value === null || value === undefined) return '';
      return String(value).toLowerCase();
    };

    const matchesSearch =
      normalize(order.id || order._id || order.orderNumber).includes(normalizedQuery) ||
      normalize(
        formatShippingAddress(
          order.shippingAddress,
          order.shippingCity,
          order.shippingPostalCode
        )
      ).includes(normalizedQuery) ||
      normalize(order.trackingNumber).includes(normalizedQuery);

    return matchesSearch;
  });

  const canCancelOrder = (order: ApiOrder) => {
    const status = getOrderStatus(order);
    return status === 'pending' || status === 'processing' || status === 'confirmed';
  };

    const canRequestReturn = (order: ApiOrder) => {
      const orderStatus = String(getOrderStatus(order) || '').toLowerCase();
      if (orderStatus === 'delivered' || orderStatus === 'partially_delivered') {
        return true;
      }

      return (order.items || []).some((item) => String(item.status || '').toLowerCase() === 'delivered');
    };

  if (loading && currentPage === 1) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold">My Orders</h1>
            <p className="text-muted-foreground mt-1">
              {totalOrders} {totalOrders === 1 ? 'order' : 'orders'} found
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-xl p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order ID, address, or tracking number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {orders.length === 0 ? 'No orders yet' : 'No orders found'}
            </h2>
            <p className="text-muted-foreground mb-4">
              {orders.length === 0
                ? "You haven't placed any orders yet."
                : 'Try adjusting your search or filters.'}
            </p>
            {orders.length === 0 && (
              <Link to="/shop">
                <Button>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Start Shopping
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order, index) => {
                const displayStatus = getOrderStatus(order);
                const status = statusConfig[displayStatus] || statusConfig.pending;
                const orderId = order.id || order._id || order.orderNumber || '';
                const shippingSummary = formatShippingAddress(
                  order.shippingAddress,
                  order.shippingCity,
                  order.shippingPostalCode
                );

                return (
                  <motion.div
                    key={orderId || `${order.customerId}-${order.createdAt}-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="glass-card rounded-xl p-6 hover:shadow-lg transition-shadow"
                  >
                    {/* Order Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">
                            {orderId
                              ? `Order #${orderId.slice(0, 8).toUpperCase()}`
                              : 'Order'}
                          </h3>
                          <Badge className={status.color}>
                            {status.icon}
                            <span className="ml-1">{status.label}</span>
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                          {order.shop && ` • ${order.shop.name}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">
                          {formatLKR(order.totalAmount)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {order.items?.length || 0} {order.items?.length === 1 ? 'item' : 'items'}
                        </p>
                      </div>
                    </div>

                    {/* Order Items Preview */}
                    <div className="border-t border-border/50 pt-4 mt-4">
                      <div className="space-y-2">
                        {(order.items || []).slice(0, 2).map((item, itemIndex) => (
                          <div
                            key={item.id || item.productId || item.product?._id || `${orderId}-item-${itemIndex}`}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              {item.productName} × {item.quantity}
                            </span>
                            <span>{formatLKR(item.unitPrice * item.quantity)}</span>
                          </div>
                        ))}
                        {(order.items || []).length > 2 && (
                          <p className="text-sm text-muted-foreground">
                            +{(order.items || []).length - 2} more {(order.items || []).length - 2 === 1 ? 'item' : 'items'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Shipping Info */}
                    <div className="border-t border-border/50 pt-4 mt-4">
                      <div className="flex items-start gap-2 mb-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <p className="text-sm text-muted-foreground">
                          {shippingSummary || 'Shipping address unavailable'}
                        </p>
                      </div>
                      {order.trackingNumber && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Tracking: </span>
                          <button
                            onClick={() => handleTrackOrder(order.trackingNumber!)}
                            className="text-primary font-medium hover:underline"
                          >
                            {order.trackingNumber}
                          </button>
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="border-t border-border/50 pt-4 mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(order)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>

                      {order.trackingNumber && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTrackOrder(order.trackingNumber!)}
                        >
                          <Truck className="h-4 w-4 mr-2" />
                          Track Order
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => orderId && handleReorder(orderId)}
                        disabled={!orderId || reorderLoading === orderId}
                      >
                        {reorderLoading === orderId ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4 mr-2" />
                        )}
                        Reorder
                      </Button>

                      {orderId && canRequestReturn(order) && (
                        <Link to={`/returns?orderId=${orderId}`}>
                          <Button variant="outline" size="sm">
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Return / Refund
                          </Button>
                        </Link>
                      )}

                      {orderId && canCancelOrder(order) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => {
                            setOrderToCancel(orderId);
                            setShowCancelDialog(true);
                          }}
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          Cancel Order
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && filteredOrders.length > 0 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    disabled={loading}
                    className="w-10"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || loading}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <OrderDetailsDialog
        order={selectedOrder}
        timeline={selectedOrderTimeline}
        open={showDetailsDialog}
        onClose={() => {
          setShowDetailsDialog(false);
          setSelectedOrder(null);
          setSelectedOrderTimeline([]);
        }}
      />

      <CancelOrderDialog
        open={showCancelDialog}
        onClose={() => {
          setShowCancelDialog(false);
          setOrderToCancel(null);
        }}
        onConfirm={handleCancelOrder}
        orderId={orderToCancel || ''}
      />
    </div>
  );
};

export default Orders;