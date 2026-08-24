import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownRight, Loader2, ShieldCheck } from 'lucide-react';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import Navbar from '@/components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { api, ApiWalletTransaction } from '@/lib/api';
import { formatLKR } from '@/lib/currency';
import { toast } from 'sonner';
import { useSeo } from '@/hooks/useSeo';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000, 25000, 50000];
const MIN_TOPUP = 100;

function TopupCardForm({ amount, onSuccess }: { amount: number; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements) {
      toast.error('Payments are still loading. Please wait a moment.');
      return;
    }
    const card = elements.getElement(CardElement);
    if (!card) {
      toast.error('Card form is not ready.');
      return;
    }

    setSubmitting(true);
    try {
      const intent = await api.createWalletTopupIntent(amount);

      const { error, paymentIntent } = await stripe.confirmCardPayment(intent.clientSecret, {
        payment_method: { card },
      });

      if (error) {
        throw new Error(error.message || 'Card payment failed. Please check your card details.');
      }
      if (!paymentIntent?.id) {
        throw new Error('Stripe did not return a payment confirmation.');
      }

      const result = await api.confirmWalletTopup(paymentIntent.id);
      toast.success(
        result.alreadyProcessed
          ? 'This top-up was already processed.'
          : `${formatLKR(amount)} added to your wallet.`
      );
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add money to wallet.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-semibold">Card Details</Label>
        <div
          className={`mt-1.5 rounded-lg border-2 transition-all bg-background px-4 py-3.5 ${
            cardError ? 'border-destructive' : cardComplete ? 'border-green-500' : 'border-input'
          }`}
        >
          <CardElement
            options={{
              hidePostalCode: true,
              disabled: submitting,
              style: {
                base: { fontSize: '15px', color: 'inherit', fontFamily: '"Inter", system-ui, sans-serif' },
                invalid: { color: '#dc2626' },
              },
            }}
            onChange={(event) => {
              setCardError(event.error?.message || null);
              setCardComplete(event.complete || false);
            }}
          />
        </div>
        {cardError && <p className="text-xs text-destructive mt-1">{cardError}</p>}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
        SSL encrypted &amp; PCI compliant, processed by Stripe
      </div>

      <Button onClick={handlePay} disabled={submitting || !stripe || amount < MIN_TOPUP} className="w-full">
        {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {submitting ? 'Processing…' : `Add ${formatLKR(amount)} to Wallet`}
      </Button>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const Wallet: React.FC = () => {
  useSeo({ title: 'My Wallet', noindex: true });

  const [balance, setBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [transactions, setTransactions] = useState<ApiWalletTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [topupOpen, setTopupOpen] = useState(false);
  const [amount, setAmount] = useState(PRESET_AMOUNTS[1]);

  const loadWallet = useCallback(async () => {
    setBalanceLoading(true);
    setTxLoading(true);
    try {
      const bal = await api.getWalletBalance();
      setBalance(Number(bal.balance || 0));
    } catch {
      toast.error('Failed to load wallet balance');
    } finally {
      setBalanceLoading(false);
    }

    try {
      const res = await api.getWalletTransactions({ limit: 20 });
      setTransactions(res.transactions || []);
    } catch {
      toast.error('Failed to load transaction history');
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <WalletIcon className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-display font-bold">My Wallet</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Add money and pay for orders instantly at checkout</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-card mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                  {balanceLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  ) : (
                    <p className="text-3xl font-display font-bold">{formatLKR(balance)}</p>
                  )}
                </div>
                <Button onClick={() => setTopupOpen(true)} className="neon-button">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Money
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {txLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No wallet activity yet.</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx._id}
                    className="flex items-center justify-between rounded-lg border border-border/40 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      {tx.type === 'topup' ? (
                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{tx.description || (tx.type === 'topup' ? 'Wallet top-up' : 'Wallet payment')}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${tx.type === 'topup' ? 'text-green-500' : 'text-red-500'}`}>
                        {tx.type === 'topup' ? '+' : '-'}{formatLKR(tx.amount)}
                      </p>
                      <Badge variant="outline" className={`text-xs mt-0.5 ${STATUS_COLORS[tx.status] || ''}`}>
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={topupOpen} onOpenChange={setTopupOpen}>
        <DialogContent className="glass-card max-w-md">
          <DialogHeader>
            <DialogTitle>Add Money to Wallet</DialogTitle>
            <DialogDescription>Top up using your card. Minimum amount is {formatLKR(MIN_TOPUP)}.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {PRESET_AMOUNTS.map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant={amount === v ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAmount(v)}
                >
                  {formatLKR(v)}
                </Button>
              ))}
            </div>
            <div>
              <Label htmlFor="custom_amount">Custom Amount (LKR)</Label>
              <Input
                id="custom_amount"
                type="number"
                min={MIN_TOPUP}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1"
              />
            </div>

            {stripePromise ? (
              <Elements stripe={stripePromise}>
                <TopupCardForm
                  amount={amount}
                  onSuccess={() => {
                    setTopupOpen(false);
                    loadWallet();
                  }}
                />
              </Elements>
            ) : (
              <p className="text-sm text-destructive">Card payments are not configured for this environment.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Wallet;
