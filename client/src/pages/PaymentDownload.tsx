import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Receipt, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Navbar from '@/components/layout/Navbar';
import { useStore } from '@/store/useStore';
import { api, ApiOrder } from '@/lib/api';
import { toast } from 'sonner';

type PaymentDownloadOrder = ApiOrder & { guestInvoiceToken?: string };

const PaymentDownload: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useStore();
  const [loading, setLoading] = useState(true);
  const [orderData, setOrderData] = useState<PaymentDownloadOrder | null>(null);
  const [downloading, setDownloading] = useState(false);

  const paymentIntentId = searchParams.get('payment_intent');
  const orderId = searchParams.get('order_id');

  useEffect(() => {
    const load = async () => {
      if (!orderId) {
        toast.error('Missing order reference');
        navigate('/shop');
        return;
      }

      const guestToken = searchParams.get('guest_token');
      // If user is authenticated, try to fetch order details; if unauthorized, continue and allow guest download
      try {
        if (!guestToken) {
          const order = await api.getOrder(orderId);
          setOrderData(order);
        }
      } catch (err) {
        console.warn('Could not fetch order as authenticated user, proceeding with guest token if present');
      } finally {
        // Clear cart regardless to avoid duplicate purchases
        clearCart();
        setLoading(false);
      }
    };

    void load();
  }, [orderId, clearCart, navigate, searchParams]);

  const handleDownload = async () => {
    const guestToken = searchParams.get('guest_token');
    if (!orderId || (!orderData && !guestToken)) return toast.error('No order or guest token to download');

    setDownloading(true);
    try {
      const tokenToUse = orderData?.guestInvoiceToken || guestToken || undefined;
      const ok = await api.downloadInvoice(orderId, { guestToken: tokenToUse });
      if (ok) {
        toast.success('Invoice downloaded');
        // After download, navigate to final success page
        navigate(`/payment/success?order_id=${encodeURIComponent(orderId)}&payment_intent=${encodeURIComponent(paymentIntentId || '')}&invoice_redirected=1`);
      } else {
        toast.error('Invoice download failed');
      }
    } catch (err) {
      console.error('Invoice download error', err);
      toast.error('Error downloading invoice');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
        <Navbar />
        <div className="container py-16 flex items-center justify-center">
          <div className="text-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
              <Loader2 className="h-12 w-12 text-primary mx-auto mb-4" />
            </motion.div>
            <p className="text-muted-foreground">Preparing your invoice...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <Navbar />
      <div className="container max-w-3xl py-16">
        <Card>
          <CardContent className="text-center">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
              <h2 className="text-2xl font-semibold mb-2">Download your invoice</h2>
              <p className="text-sm text-muted-foreground mb-6">You can download the invoice for your recent order below.</p>
              <div className="space-x-3">
                <Button onClick={handleDownload} disabled={downloading} className="mr-2">
                  {downloading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Receipt className="h-4 w-4 mr-2" />
                      Download Invoice
                    </>
                  )}
                </Button>

                <Button variant="outline" onClick={() => navigate(`/payment/success?order_id=${encodeURIComponent(orderId || '')}&payment_intent=${encodeURIComponent(paymentIntentId || '')}&invoice_redirected=1`)}>
                  Continue
                </Button>
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentDownload;
