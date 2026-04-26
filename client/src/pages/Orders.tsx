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
import { api, ApiOrder } from '@/lib/api';
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
  shipped: {
    icon: <Truck className="h-4 w-4" />,
    color: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
    label: 'Shipped',
  },
  delivered: {
    icon: <CheckCircle className="h-4 w-4" />,
    color: 'bg-green-500/20 text-green-500 border-green-500/30',
    label: 'Delivered',
  },
  cancelled: {
    icon: <XCircle className="h-4 w-4" />,
    color: 'bg-red-500/20 text-red-500 border-red-500/30',
    label: 'Cancelled',
  },
};

const Orders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<ApiOrder | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
  const [reorderLoading, setReorderLoading] = useState<string | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const ordersPerPage = 10;

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

  const handleViewDetails = (order: ApiOrder) => {
    setSelectedOrder(order);
    setShowDetailsDialog(true);
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
    } catch (err) {
      const error = err as Error;
      toast({
        title: 'Cancellation Failed',
        description: error.message || 'Failed to cancel order. Please try again.',
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
    } catch (err) {
      const error = err as Error;
      toast({
        title: 'Reorder Failed',
        description: error.message || 'Failed to add items to cart. Please try again.',
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
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.shippingAddress?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const canCancelOrder = (order: ApiOrder) => {
    return order.status === 'pending' || order.status === 'processing';
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
                const status = statusConfig[order.status] || statusConfig.pending;

                return (
                  <motion.div
                    key={order.id}
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
                            Order #{order.id.slice(0, 8).toUpperCase()}
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
                        {(order.items || []).slice(0, 2).map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
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
                          {order.shippingAddress}
                          {order.shippingCity && `, ${order.shippingCity}`}
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
                        onClick={() => handleReorder(order.id)}
                        disabled={reorderLoading === order.id}
                      >
                        {reorderLoading === order.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4 mr-2" />
                        )}
                        Reorder
                      </Button>

                      {canCancelOrder(order) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => {
                            setOrderToCancel(order.id);
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
        open={showDetailsDialog}
        onClose={() => {
          setShowDetailsDialog(false);
          setSelectedOrder(null);
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
