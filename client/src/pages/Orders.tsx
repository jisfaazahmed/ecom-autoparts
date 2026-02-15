import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Package, Truck, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiOrder } from '@/lib/api';
import { formatLKR } from '@/lib/currency';

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
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;

      try {
        const response = await api.getOrders();
        setOrders(response.data || []);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      }

      setLoading(false);
    };

    fetchOrders();
  }, [user]);

  if (loading) {
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
        <h1 className="text-3xl font-display font-bold mb-8">My Orders</h1>

        {orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
            <p className="text-muted-foreground mb-4">
              You haven't placed any orders yet.
            </p>
            <Link to="/shop">
              <Button>Start Shopping</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, index) => {
              const status = statusConfig[order.status] || statusConfig.pending;
              
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="glass-card rounded-xl p-6"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">
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
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="border-t border-border/50 pt-4 mt-4">
                    <div className="space-y-2">
                      {(order.items || []).slice(0, 3).map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {item.productName} × {item.quantity}
                          </span>
                          <span>{formatLKR(item.unitPrice * item.quantity)}</span>
                        </div>
                      ))}
                      {(order.items || []).length > 3 && (
                        <p className="text-sm text-muted-foreground">
                          +{(order.items || []).length - 3} more items
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Shipping Info */}
                  <div className="border-t border-border/50 pt-4 mt-4">
                    <p className="text-sm text-muted-foreground">
                      Ship to: {order.shippingAddress}
                      {order.shippingCity && `, ${order.shippingCity}`}
                    </p>
                    {order.trackingNumber && (
                      <p className="text-sm mt-1">
                        <span className="text-muted-foreground">Tracking: </span>
                        <span className="text-primary font-medium">
                          {order.trackingNumber}
                        </span>
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
