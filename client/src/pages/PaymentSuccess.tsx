import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Package, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/layout/Navbar';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const PaymentSuccess: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useStore();
  const [cleared, setCleared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orderNumber, setOrderNumber] = useState<string>('');
  
  const sessionId = searchParams.get('session_id');
  const orderId = searchParams.get('order_id');

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId || !orderId) {
        toast.error('Invalid payment session');
        navigate('/orders');
        return;
      }

      try {
        // Fetch order details to confirm payment
        const order = await api.getOrder(orderId);
        
        if (order && order.paymentStatus === 'completed') {
          setOrderNumber(order.orderNumber || '');
          
          // Clear cart on successful payment
          if (!cleared) {
            clearCart();
            setCleared(true);
          }
        } else {
          toast.info('Payment is being processed...');
        }
      } catch (error) {
        console.error('Error verifying payment:', error);
        toast.error('Failed to verify payment');
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [sessionId, orderId, clearCart, cleared, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-16 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Verifying your payment...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg mx-auto text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center"
          >
            <CheckCircle className="h-12 w-12 text-green-500" />
          </motion.div>

          <h1 className="text-3xl font-display font-bold mb-4 text-foreground">
            Payment Successful!
          </h1>
          
          <p className="text-muted-foreground mb-8">
            Thank you for your order. Your payment has been processed successfully 
            and your order is now being prepared for shipment.
          </p>

          <div className="glass-card rounded-xl p-6 mb-8">
            <div className="flex items-center justify-center gap-3 text-primary">
              <Package className="h-5 w-5" />
              <span className="font-medium">Order Confirmed</span>
            </div>
            {orderNumber && (
              <p className="text-sm font-semibold mt-3 text-foreground">
                Order #{orderNumber}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              You will receive an email confirmation shortly with your order details.
            </p>
            {sessionId && (
              <p className="text-xs text-muted-foreground mt-2">
                Transaction ID: {sessionId.slice(0, 20)}...
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate('/orders')}
              className="gap-2"
            >
              View My Orders
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate('/shop')}
            >
              Continue Shopping
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
