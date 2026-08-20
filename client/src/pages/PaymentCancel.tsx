import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, ShoppingCart, Home, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Navbar from '@/components/layout/Navbar';
import { toast } from 'sonner';
import { useSeo } from '@/hooks/useSeo';

const PaymentCancel: React.FC = () => {
  useSeo({ title: 'Payment Cancelled', noindex: true });
  const navigate = useNavigate();

  useEffect(() => {
    // Show info toast when user lands on this page
    toast.info('Payment was cancelled. Your cart items are still available.');
  }, []);

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
          {/* Error Icon Animation */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            className="w-28 h-28 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border-2 border-amber-500/30"
          >
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <AlertCircle className="h-16 w-16 text-amber-500" />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-3 bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              Payment Cancelled
            </h1>
            <p className="text-lg text-muted-foreground">
              Your payment was cancelled, but don't worry – your cart items are saved and ready for checkout.
            </p>
          </motion.div>
        </motion.div>

        {/* Info Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="grid md:grid-cols-2 gap-6 mb-8"
        >
          {/* Why This Happened */}
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-blue-500/10">
                    <AlertCircle className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Common Reasons</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• You closed the payment window</li>
                    <li>• Network connection interrupted</li>
                    <li>• You chose to go back</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What Happens Now */}
          <Card className="border-0 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-green-500/10">
                    <ShoppingCart className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Your Items</h3>
                  <p className="text-sm text-muted-foreground">
                    Your cart has been preserved with all items. You can review and complete checkout whenever you're ready.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Troubleshooting Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-6 mb-8"
        >
          <div className="flex items-start gap-4">
            <Phone className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">Need Help?</h3>
              <p className="text-sm text-purple-800 dark:text-purple-200 mb-4">
                If you're having trouble completing your payment, our support team is ready to assist.
              </p>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-purple-600 hover:text-purple-700"
                >
                  Contact Support
                </Button>
              </div>
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
            onClick={() => navigate('/checkout')}
            size="lg"
            className="gap-2 text-base"
          >
            <ShoppingCart className="h-5 w-5" />
            Return to Checkout
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
          <Button 
            variant="ghost"
            onClick={() => navigate('/')}
            size="lg"
            className="gap-2 text-base"
          >
            <Home className="h-5 w-5" />
            Back to Home
          </Button>
        </motion.div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-12 pt-8 border-t border-border/50 text-center"
        >
          <p className="text-sm text-muted-foreground mb-2">
            💡 Tip: Make sure you have a stable internet connection before retrying payment
          </p>
          <p className="text-xs text-muted-foreground">
            Your session will remain open for 24 hours. After that, you'll need to place a new order.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default PaymentCancel;
