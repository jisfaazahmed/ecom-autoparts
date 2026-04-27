import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, Package, ArrowRight, Loader2, Truck, Clock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  const [orderData, setOrderData] = useState<any>(null);
  
  const sessionId = searchParams.get('session_id');
  const paymentIntentId = searchParams.get('payment_intent');
  const orderId = searchParams.get('order_id');

  useEffect(() => {
    const verifyPayment = async () => {
      if (!orderId || (!sessionId && !paymentIntentId)) {
        toast.error('Invalid payment session');
        navigate('/orders');
        return;
      }

      try {
        // Fetch order details to confirm payment
        const order = await api.getOrder(orderId);
        
        if (order && order.paymentStatus === 'completed') {
          setOrderNumber(order.orderNumber || '');
          setOrderData(order);
          
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
  }, [sessionId, paymentIntentId, orderId, clearCart, cleared, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <Navbar />
        <div className="container py-16 flex items-center justify-center">
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-12 w-12 text-primary mx-auto mb-4" />
            </motion.div>
            <p className="text-muted-foreground">Verifying your payment...</p>
            <p className="text-xs text-muted-foreground mt-2">This may take a few moments</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navbar />
      
      <div className="container max-w-4xl py-16 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          {/* Success Checkmark Animation */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            className="w-28 h-28 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center border-2 border-green-500/30"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <CheckCircle className="h-16 w-16 text-green-500" />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-3 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Payment Successful! 🎉
            </h1>
            <p className="text-lg text-muted-foreground">
              Thank you for your purchase. Your order is confirmed and being prepared for shipment.
            </p>
          </motion.div>
        </motion.div>

        {/* Order Details Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid md:grid-cols-3 gap-6 mb-8"
        >
          {/* Order Number */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-500/5 to-transparent">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-500/10 mb-3">
                  <Package className="h-6 w-6 text-blue-500" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">Order Number</p>
                <p className="text-2xl font-bold text-foreground">{orderNumber}</p>
              </div>
            </CardContent>
          </Card>

          {/* Estimated Delivery */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-500/5 to-transparent">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-purple-500/10 mb-3">
                  <Truck className="h-6 w-6 text-purple-500" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">Estimated Delivery</p>
                <p className="text-2xl font-bold text-foreground">3-5 Days</p>
              </div>
            </CardContent>
          </Card>

          {/* Confirmation Email */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-orange-500/5 to-transparent">
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-orange-500/10 mb-3">
                  <Mail className="h-6 w-6 text-orange-500" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">Confirmation Sent</p>
                <p className="text-sm font-medium text-foreground truncate">Check your email</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Next Steps */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8"
        >
          <div className="flex items-start gap-4">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">What Happens Next?</h3>
              <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <li>✓ Your order has been confirmed and is being prepared</li>
                <li>✓ You'll receive a shipping notification with tracking information</li>
                <li>✓ Your package will arrive within 3-5 business days</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button 
            onClick={() => navigate(`/orders/${orderNumber || ''}`)}
            size="lg"
            className="gap-2 text-base"
          >
            <Package className="h-5 w-5" />
            View Order Details
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate('/shop')}
            size="lg"
            className="gap-2 text-base"
          >
            Continue Shopping
            <ArrowRight className="h-5 w-5" />
          </Button>
        </motion.div>

        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-12 pt-8 border-t border-border/50"
        >
          <p className="text-center text-sm text-muted-foreground mb-4">Your transaction is secure & encrypted</p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              SSL Encrypted
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Secure Payment
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              Data Protected
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
