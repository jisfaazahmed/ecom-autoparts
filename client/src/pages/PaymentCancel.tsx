import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, ShoppingCart, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/layout/Navbar';

const PaymentCancel: React.FC = () => {
  const navigate = useNavigate();

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
            className="w-24 h-24 mx-auto mb-6 rounded-full bg-destructive/20 flex items-center justify-center"
          >
            <XCircle className="h-12 w-12 text-destructive" />
          </motion.div>

          <h1 className="text-3xl font-display font-bold mb-4 text-foreground">
            Payment Cancelled
          </h1>
          
          <p className="text-muted-foreground mb-8">
            Your payment was cancelled and no charges were made. 
            Your cart items are still saved if you'd like to try again.
          </p>

          <div className="glass-card rounded-xl p-6 mb-8">
            <div className="flex items-center justify-center gap-3 text-muted-foreground">
              <ShoppingCart className="h-5 w-5" />
              <span className="font-medium">Cart items preserved</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              You can return to checkout anytime to complete your purchase.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => navigate('/checkout')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to Checkout
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

export default PaymentCancel;
