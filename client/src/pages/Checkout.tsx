import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, CreditCard, Truck, Check, AlertCircle, Loader2, Tag, ShieldCheck } from 'lucide-react';
import { CardElement, Elements, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiCoupon, ApiAddress } from '@/lib/api';
import { toast } from 'sonner';
import { formatLKR } from '@/lib/currency';

interface StockIssue {
  productId: string;
  productName: string;
  requested: number;
  available: number;
}

interface ShippingForm {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
}

const DEFAULT_SHIPPING_COST = 500;
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const useStripeMock = (import.meta.env.VITE_USE_STRIPE_MOCK as string | undefined) === 'true';
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

const ZONE_1_CITIES = ['colombo'];
const ZONE_2_CITIES = ['gampaha', 'kaluthara'];
const ZONE_3_CITIES = [
  'kurunegala',
  'kandy',
  'matale',
  'nuwara eliya',
  'galle',
  'matara',
  'hambantota',
  'puttalam',
  'anuradhapura',
  'polonnaruwa',
  'badulla',
  'monaragala',
  'ratnapura',
  'kegalle',
  'trincomalee',
  'batticaloa',
  'ampara',
  'jaffna',
  'vavuniya',
  'mannar',
  'kilinochchi',
  'mullaitivu',
];

function getZoneMultiplier(city: string) {
  const normalizedCity = String(city || '').trim().toLowerCase();
  if (ZONE_1_CITIES.includes(normalizedCity)) return 100;
  if (ZONE_2_CITIES.includes(normalizedCity)) return 200;
  if (ZONE_3_CITIES.includes(normalizedCity)) return 300;
  return 0;
}

type ConfirmInlineCardFn = (
  clientSecret: string,
  billing: { name: string; email: string; phone: string }
) => Promise<string>;

interface MockCardInput {
  cardNumber: string;
  cardHolder: string;
  expiry: string;
  cvc: string;
}

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function validateMockCard(card: MockCardInput): string | null {
  const number = card.cardNumber.replace(/\s/g, '');
  if (number.length !== 16) return 'Enter a valid 16-digit card number';
  if (!card.cardHolder.trim()) return 'Card holder name is required';
  if (!/^\d{2}\/\d{2}$/.test(card.expiry)) return 'Enter expiry in MM/YY format';
  if (!/^\d{3,4}$/.test(card.cvc)) return 'Enter a valid CVC';
  return null;
}

function InlineCardForm({
  onReady,
  disabled,
}: {
  onReady: (fn: ConfirmInlineCardFn | null) => void;
  disabled: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardError, setCardError] = useState<string | null>(null);

  useEffect(() => {
    onReady(async (clientSecret, billing) => {
      if (!stripe || !elements) {
        throw new Error('Stripe is not ready yet. Please wait a moment and try again.');
      }

      const card = elements.getElement(CardElement);
      if (!card) {
        throw new Error('Card form is not ready. Please re-enter card details.');
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card,
          billing_details: {
            name: billing.name,
            email: billing.email,
            phone: billing.phone,
          },
        },
      });

      if (error) {
        throw new Error(error.message || 'Card payment failed. Please check your card details.');
      }

      if (!paymentIntent?.id) {
        throw new Error('Stripe did not return a payment intent.');
      }

      return paymentIntent.id;
    });

    return () => onReady(null);
  }, [elements, onReady, stripe]);

  return (
    <div className="space-y-3">
      <Label htmlFor="card-element">Card Details</Label>
      <div
        id="card-element"
        className="rounded-md border border-input bg-background px-3 py-3"
      >
        <CardElement
          options={{
            hidePostalCode: true,
            disabled,
            style: {
              base: {
                fontSize: '16px',
                color: '#1f2937',
                '::placeholder': {
                  color: '#9ca3af',
                },
              },
              invalid: {
                color: '#dc2626',
              },
            },
          }}
          onChange={(event) => {
            if (event.error?.message) {
              setCardError(event.error.message);
            } else {
              setCardError(null);
            }
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Use Stripe test card: 4242 4242 4242 4242, any future date, any CVC.
      </p>
      {cardError && <p className="text-sm text-destructive">{cardError}</p>}
    </div>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const { cart, clearCart, getCartTotal } = useStore();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'wallet' | 'cod'>('stripe');
  const [confirmInlineCard, setConfirmInlineCard] = useState<ConfirmInlineCardFn | null>(null);
  const [mockCard, setMockCard] = useState<MockCardInput>({
    cardNumber: '4242 4242 4242 4242',
    cardHolder: '',
    expiry: '12/34',
    cvc: '123',
  });
  const [loading, setLoading] = useState(false);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [shippingCost, setShippingCost] = useState(DEFAULT_SHIPPING_COST);
  const [stockIssues, setStockIssues] = useState<StockIssue[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<ApiCoupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletOtp, setWalletOtp] = useState('');
  const [walletPendingOrderId, setWalletPendingOrderId] = useState<string | null>(null);
  const [walletMockOtpHint, setWalletMockOtpHint] = useState<string | null>(null);
  
  const [savedAddresses, setSavedAddresses] = useState<ApiAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new');

  const [form, setForm] = useState<ShippingForm>({
    fullName: '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
  });

  const checkStock = useCallback(async () => {
    try {
      const items = cart.filter(item => item && item.product).map((item) => ({
        productId: item.product.id || item.product._id || item.id,
        quantity: item.quantity,
      }));

      const stockResults = await api.checkStock(items);
      const issues: StockIssue[] = [];

      for (const result of stockResults) {
        if (!result.sufficient) {
          issues.push({
            productId: result.productId,
            productName: result.name,
            requested: result.requested,
            available: result.available,
          });
        }
      }

      setStockIssues(issues);
    } catch (error) {
      console.error('Error checking stock:', error);
    }
  }, [cart]);

  useEffect(() => {
    if (cart.length === 0) {
      navigate('/cart');
      return;
    }

    // Check stock on mount
    checkStock();
  }, [cart.length, navigate, checkStock]);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        email: user.email || prev.email,
        fullName: user.fullName || prev.fullName,
        phone: user.phone || prev.phone,
      }));
      api.getAddresses().then(addresses => {
        setSavedAddresses(addresses);
        if (addresses.length > 0) {
           setSelectedAddressId(addresses[0]._id);
           const addr = addresses[0];
           setForm((prev) => ({
             ...prev,
             fullName: addr.fullName,
             phone: addr.phone,
             address: addr.addressLine1,
             city: addr.city,
             postalCode: addr.postalCode,
           }));
        }
      }).catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    if (!user || paymentMethod !== 'wallet') return;

    setWalletLoading(true);
    api.getWalletBalance()
      .then((wallet) => setWalletBalance(Number(wallet.balance || 0)))
      .catch(() => setWalletBalance(0))
      .finally(() => setWalletLoading(false));
  }, [user, paymentMethod]);

  const handleAddressSelect = (addrId: string) => {
    setSelectedAddressId(addrId);
    if (addrId === 'new') {
        setForm(prev => ({
            ...prev,
            fullName: '',
            phone: '',
            address: '',
            city: '',
            postalCode: '',
        }));
    } else {
        const addr = savedAddresses.find(a => a._id === addrId);
        if (addr) {
            setForm((prev) => ({
                 ...prev,
                 fullName: addr.fullName,
                 phone: addr.phone,
                 address: addr.addressLine1,
                 city: addr.city,
                 postalCode: addr.postalCode,
            }));
        }
    }
  };

  const cartTotal = getCartTotal();
  const taxAmount = Math.round(cartTotal * 0.18);
  const finalTotal = cartTotal + shippingCost + taxAmount - discountAmount;
  const validCart = cart.filter(item => item && item.product);

  // Get unique shop IDs from cart
  const shopIds = [...new Set(validCart.map((item) => item.product.shopId))].filter(Boolean);
  const shopId = shopIds[0]; // For simplicity, assume single shop checkout

  const recalculateShipping = useCallback(async () => {
    if (!validCart.length) {
      setShippingCost(0);
      setShippingError(null);
      return;
    }

    setShippingLoading(true);
    try {
      const totalWeight = validCart.reduce((sum, item) => {
        const weight = item.product.weight || 0.5;
        return sum + (weight * item.quantity);
      }, 0);

      const zoneMultiplier = getZoneMultiplier(form.city);
      const computedShipping = Math.round(300 + (totalWeight * 50) + zoneMultiplier + 300);

      setShippingCost(Number.isFinite(computedShipping) ? computedShipping : DEFAULT_SHIPPING_COST);
      setShippingError(
        form.city.trim()
          ? null
          : 'Enter your city to include zone-based shipping charge.'
      );
    } finally {
      setShippingLoading(false);
    }
  }, [form.city, validCart]);

  useEffect(() => {
    void recalculateShipping();
  }, [recalculateShipping]);

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }
    // ShopId validation isn't strictly necessary everywhere
    // if (!shopId) {
    //   toast.error('Cannot validate coupon without a shop.');
    //   return;
    // }

    setValidatingCoupon(true);
    try {
      const result = await api.validateCoupon(couponCode, cartTotal, shopId);

      if (result.valid && result.coupon) {
        setAppliedCoupon(result.coupon);
        setDiscountAmount(result.discountAmount || 0);
        toast.success('Coupon applied successfully!');
      } else {
        toast.error(result.message || 'Invalid coupon');
        setAppliedCoupon(null);
        setDiscountAmount(0);
      }
    } catch (error) {
      toast.error('Failed to validate coupon');
      setAppliedCoupon(null);
      setDiscountAmount(0);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setCouponCode('');
    toast.info('Coupon removed');
  };

  const handleInlineCardReady = useCallback((fn: ConfirmInlineCardFn | null) => {
    setConfirmInlineCard(() => fn);
  }, []);

  const handleInputChange = (field: keyof ShippingForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const validateShippingForm = (): boolean => {
    const required: (keyof ShippingForm)[] = ['fullName', 'email', 'phone', 'address', 'city', 'postalCode'];
    for (const field of required) {
      if (!form[field]?.trim()) {
        toast.error(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return false;
      }
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      toast.error('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleInlineCardCheckout = async () => {
    if (stockIssues.length > 0) {
      toast.error('Please resolve stock issues before checkout');
      return;
    }

    if (!validateShippingForm()) {
      return;
    }

    if (!user?.id) {
      toast.error('Please sign in before paying by card');
      navigate('/auth/customer', {
        replace: true,
        state: { message: 'Sign in to continue with card payment.' },
      });
      return;
    }

    const isMockInline = useStripeMock && !stripePromise;
    if (!isMockInline && !stripePromise) {
      toast.error('Stripe card form is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY first.');
      return;
    }

    if (!isMockInline && !confirmInlineCard) {
      toast.error('Card form is not ready. Please wait and try again.');
      return;
    }

    if (isMockInline) {
      const validation = validateMockCard(mockCard);
      if (validation) {
        toast.error(validation);
        return;
      }
    }

    setLoading(true);

    try {
      const orderItems = validCart.map((item) => ({
        productId: item.product.id || item.product._id || item.id,
        quantity: item.quantity,
      }));

      const order = await api.createOrder({
        items: orderItems,
        shippingAddress: form.address,
        shippingCity: form.city,
        shippingPostalCode: form.postalCode,
        fullName: form.fullName,
        phone: form.phone,
        shippingCountry: 'Sri Lanka',
        paymentMethod: 'card',
        shopId,
        couponCode: appliedCoupon?.code,
      });

      const orderId = order.id || order._id;
      if (!orderId) {
        throw new Error('Order created but order ID was not returned');
      }

      const paymentIntent = await api.createPaymentIntent({ orderId });

      const paymentIntentId = isMockInline
        ? paymentIntent.paymentIntentId
        : await confirmInlineCard!(paymentIntent.clientSecret, {
            name: form.fullName,
            email: form.email,
            phone: form.phone,
          });

      await api.confirmPaymentIntent({
        orderId,
        paymentIntentId,
      });

      clearCart();
      toast.success('Card payment completed successfully!');
      navigate(`/payment/success?order_id=${encodeURIComponent(orderId)}&payment_intent=${encodeURIComponent(paymentIntentId)}`);
    } catch (error) {
      console.error('Inline card checkout error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process card payment');
    } finally {
      setLoading(false);
    }
  };

  const handleCODCheckout = async () => {
    if (stockIssues.length > 0) {
      toast.error('Please resolve stock issues before checkout');
      return;
    }

    if (!validateShippingForm()) {
      return;
    }

    setLoading(true);

    try {
      const orderItems = validCart.map((item) => ({
        productId: item.product.id || item.product._id || item.id,
        quantity: item.quantity,
      }));

      const order = await api.createOrder({
        items: orderItems,
        shippingAddress: form.address,
        shippingCity: form.city,
        shippingPostalCode: form.postalCode,
        fullName: form.fullName,
        phone: form.phone,
        shippingCountry: 'Sri Lanka',
        paymentMethod: 'cod',
        shopId,
        couponCode: appliedCoupon?.code,
        notes: 'Cash on Delivery',
      });

      clearCart();
      toast.success('Order placed successfully!');
      
      // Check if user is logged in
      if (user) {
        navigate('/orders', { replace: true });
      } else {
        // For guest users, redirect to login with success message
        toast.info('Please log in to view your orders');
        navigate('/auth/customer', { 
          replace: true, 
          state: { message: 'Order placed successfully! Please log in to view your order details.' }
        });
      }
    } catch (error) {
      console.error('COD order error:', error);
      toast.error( 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const handleWalletCheckout = async () => {
    if (stockIssues.length > 0) {
      toast.error('Please resolve stock issues before checkout');
      return;
    }

    if (!validateShippingForm()) {
      return;
    }

    if (!user?.id) {
      toast.error('Please sign in before paying with wallet');
      navigate('/auth/customer', {
        replace: true,
        state: { message: 'Sign in to continue with wallet payment.' },
      });
      return;
    }

    setLoading(true);

    try {
      let orderId = walletPendingOrderId;

      if (!orderId) {
        const orderItems = validCart.map((item) => ({
          productId: item.product.id || item.product._id || item.id,
          quantity: item.quantity,
        }));

        const order = await api.createOrder({
          items: orderItems,
          shippingAddress: form.address,
          shippingCity: form.city,
          shippingPostalCode: form.postalCode,
          fullName: form.fullName,
          phone: form.phone,
          shippingCountry: 'Sri Lanka',
          paymentMethod: 'wallet',
          shopId,
          couponCode: appliedCoupon?.code,
        });

        orderId = order.id || order._id || null;
        if (!orderId) {
          throw new Error('Wallet order created but order ID was not returned');
        }
      }

      const walletResult = await api.payWithWallet({
        orderId,
        otp: walletOtp.trim() || undefined,
      });

      if (walletResult.requiresOtp) {
        setWalletPendingOrderId(orderId);
        setWalletMockOtpHint(walletResult.mockOtp || null);
        toast.info('OTP sent. Please enter OTP to confirm wallet payment.');
        return;
      }

      setWalletBalance(Number(walletResult.balance || walletBalance));
      setWalletPendingOrderId(null);
      setWalletMockOtpHint(null);
      setWalletOtp('');
      clearCart();
      toast.success('Wallet payment completed successfully!');
      navigate(`/payment/success?order_id=${encodeURIComponent(orderId)}&method=wallet`);
    } catch (error) {
      console.error('Wallet checkout error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process wallet payment');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = () => {
    if (paymentMethod === 'stripe') {
      handleInlineCardCheckout();
    } else if (paymentMethod === 'wallet') {
      handleWalletCheckout();
    } else {
      handleCODCheckout();
    }
  };

  const steps = [
    { number: 1, title: 'Shipping', icon: Truck },
    { number: 2, title: 'Payment', icon: CreditCard },
    { number: 3, title: 'Review', icon: Check },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 py-8">
      <div className="container max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-display font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Secure Checkout
          </h1>
          <p className="text-muted-foreground">Complete your purchase securely in just 3 steps</p>
        </div>

        {/* Modern Progress Steps */}
        <div className="mb-10">
          <div className="relative flex items-center justify-between max-w-xl mx-auto">
            {steps.map((s, index) => (
              <React.Fragment key={s.number}>
                {/* Step Circle */}
                <div className="flex flex-col items-center">
                  <motion.div
                    initial={false}
                    animate={{
                      scale: step === s.number ? 1.15 : step > s.number ? 1 : 0.9,
                    }}
                    className={`
                      relative flex items-center justify-center w-12 h-12 rounded-full font-semibold transition-all
                      ${step >= s.number
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                        : 'bg-muted text-muted-foreground'}
                    `}
                  >
                    {step > s.number ? (
                      <Check className="h-6 w-6" />
                    ) : (
                      s.number
                    )}
                  </motion.div>
                  <span className={`mt-2 text-sm font-medium hidden sm:block ${step >= s.number ? 'text-primary' : 'text-muted-foreground'}`}>
                    {s.title}
                  </span>
                </div>

                {/* Connecting Line */}
                {index < steps.length - 1 && (
                  <motion.div
                    initial={false}
                    animate={{
                      background: step > s.number ? '#3b82f6' : '#e5e7eb',
                    }}
                    transition={{ duration: 0.5 }}
                    className="flex-1 h-1 mx-2 rounded-full"
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Stock Issues Alert */}
        {stockIssues.length > 0 && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-2">Some items have stock issues:</p>
              <ul className="list-disc list-inside">
                {stockIssues.map((issue) => (
                  <li key={issue.productId}>
                    {issue.productName}: only {issue.available} available (you requested {issue.requested})
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => navigate('/cart')}
              >
                Update Cart
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 1: Shipping */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="h-5 w-5" />
                      Shipping Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {savedAddresses.length > 0 && (
                      <div className="mb-6 space-y-4">
                        <Label className="text-base font-semibold">Select Shipping Address</Label>
                        <RadioGroup
                          value={selectedAddressId}
                          onValueChange={handleAddressSelect}
                          className="grid gap-4"
                        >
                          {savedAddresses.map((addr) => (
                            <Label
                              key={addr._id}
                              htmlFor={addr._id}
                              className={`flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                                selectedAddressId === addr._id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                              }`}
                            >
                              <RadioGroupItem value={addr._id} id={addr._id} className="mt-1" />
                              <div className="space-y-1 w-full">
                                <p className="font-medium leading-none flex items-center justify-between">
                                    <span>{addr.fullName}</span>
                                    {addr.addressType && <span className="text-xs py-0.5 px-2 bg-primary/10 text-primary rounded-full uppercase">{addr.addressType}</span>}
                                </p>
                                <p className="text-sm text-muted-foreground">{addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ''}</p>
                                <p className="text-sm text-muted-foreground">{addr.city}, {addr.postalCode}, {addr.state}</p>
                                <p className="text-sm text-muted-foreground">{addr.phone}</p>
                              </div>
                            </Label>
                          ))}
                          <Label
                            htmlFor="new"
                            className={`flex items-center space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                              selectedAddressId === 'new' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                            }`}
                          >
                            <RadioGroupItem value="new" id="new" />
                            <span className="font-medium">Deliver to a new address</span>
                          </Label>
                        </RadioGroup>
                      </div>
                    )}

                    {selectedAddressId === 'new' && (
                      <div className="space-y-4 pt-4 border-t">
                        <h3 className="font-medium mb-4">Enter New Address details</h3>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <Label>Full Name *</Label>
                            <Input
                              value={form.fullName}
                              onChange={(e) => handleInputChange('fullName', e.target.value)}
                              placeholder="John Doe"
                            />
                          </div>
                          <div>
                            <Label>Email *</Label>
                            <Input
                              type="email"
                              value={form.email}
                              onChange={(e) => handleInputChange('email', e.target.value)}
                              placeholder="john@example.com"
                            />
                          </div>
                        </div>

                        <div>
                          <Label>Phone *</Label>
                          <Input
                            value={form.phone}
                            onChange={(e) => handleInputChange('phone', e.target.value)}
                            placeholder="+1 234 567 8900"
                          />
                        </div>

                        <div>
                          <Label>Address *</Label>
                          <Input
                            value={form.address}
                            onChange={(e) => handleInputChange('address', e.target.value)}
                            placeholder="123 Main Street"
                          />
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <Label>City *</Label>
                            <Input
                              value={form.city}
                              onChange={(e) => handleInputChange('city', e.target.value)}
                              placeholder="New York"
                            />
                          </div>
                          <div>
                            <Label>Postal Code *</Label>
                            <Input
                              value={form.postalCode}
                              onChange={(e) => handleInputChange('postalCode', e.target.value)}
                              placeholder="10001"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      className="w-full mt-4"
                      onClick={() => {
                        if (validateShippingForm()) {
                          setStep(2);
                        }
                      }}
                    >
                      Continue to Payment
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 2: Payment */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="border-0 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent pb-6">
                    <CardTitle className="flex items-center gap-3 text-2xl">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <CreditCard className="h-6 w-6 text-primary" />
                      </div>
                      Choose Payment Method
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-2">Select your preferred payment method to complete your purchase</p>
                  </CardHeader>
                  <CardContent className="pt-8">
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(value) => {
                        if (value === 'stripe' || value === 'wallet' || value === 'cod') {
                          setPaymentMethod(value as 'stripe' | 'wallet' | 'cod');
                        }
                      }}
                      className="space-y-4 mb-8"
                    >
                      {/* Credit Card Option */}
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className={`
                          relative p-6 rounded-xl border-2 cursor-pointer transition-all
                          ${paymentMethod === 'stripe'
                            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                            : 'border-border hover:border-muted-foreground/50 bg-background'}
                        `}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <RadioGroupItem value="stripe" id="stripe" className="mt-1" />
                            <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                              <span className="text-base font-semibold block">💳 Credit / Debit Card</span>
                              <span className="text-sm text-muted-foreground mt-1 block">Visa, Mastercard, and more. Fast & secure checkout.</span>
                            </Label>
                          </div>
                          <motion.div
                            initial={false}
                            animate={{ scale: paymentMethod === 'stripe' ? 1 : 0.8, opacity: paymentMethod === 'stripe' ? 1 : 0.5 }}
                            className="flex gap-2 ml-4"
                          >
                            <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-0">Visa</Badge>
                            <Badge variant="secondary" className="bg-red-500/10 text-red-600 border-0">MC</Badge>
                          </motion.div>
                        </div>
                        {paymentMethod === 'stripe' && (
                          <motion.div
                            layoutId="selected-indicator"
                            className="absolute top-3 right-3 p-1.5 bg-primary rounded-full"
                          >
                            <Check className="h-4 w-4 text-white" />
                          </motion.div>
                        )}
                      </motion.div>

                      {/* Wallet Option */}
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className={`
                          relative p-6 rounded-xl border-2 cursor-pointer transition-all
                          ${paymentMethod === 'wallet'
                            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                            : 'border-border hover:border-muted-foreground/50 bg-background'}
                        `}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4 flex-1">
                            <RadioGroupItem value="wallet" id="wallet" className="mt-1" />
                            <Label htmlFor="wallet" className="flex-1 cursor-pointer">
                              <span className="text-base font-semibold block">Wallet</span>
                              <span className="text-sm text-muted-foreground mt-1 block">Use your wallet balance with OTP verification.</span>
                            </Label>
                          </div>
                          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 border-0">
                            {walletLoading ? 'Loading...' : `Balance: ${formatLKR(walletBalance)}`}
                          </Badge>
                        </div>
                        {paymentMethod === 'wallet' && (
                          <motion.div
                            layoutId="selected-indicator"
                            className="absolute top-3 right-3 p-1.5 bg-primary rounded-full"
                          >
                            <Check className="h-4 w-4 text-white" />
                          </motion.div>
                        )}
                      </motion.div>

                      {/* Cash on Delivery Option */}
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        className={`
                          relative p-6 rounded-xl border-2 cursor-pointer transition-all
                          ${paymentMethod === 'cod'
                            ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                            : 'border-border hover:border-muted-foreground/50 bg-background'}
                        `}
                      >
                        <div className="flex items-start gap-4 flex-1">
                          <RadioGroupItem value="cod" id="cod" className="mt-1" />
                          <Label htmlFor="cod" className="flex-1 cursor-pointer">
                            <span className="text-base font-semibold block">🚚 Cash on Delivery</span>
                            <span className="text-sm text-muted-foreground mt-1 block">Pay conveniently when your order arrives at your doorstep.</span>
                          </Label>
                        </div>
                        {paymentMethod === 'cod' && (
                          <motion.div
                            layoutId="selected-indicator"
                            className="absolute top-3 right-3 p-1.5 bg-primary rounded-full"
                          >
                            <Check className="h-4 w-4 text-white" />
                          </motion.div>
                        )}
                      </motion.div>
                    </RadioGroup>

                    {paymentMethod === 'stripe' && (
                      <div className="mt-4 space-y-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Card Processing</p>
                          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {useStripeMock ? 'Stripe mock API' : 'PCI-ready flow'}
                          </div>
                        </div>
                        <div className="flex items-start space-x-3 rounded-lg border border-border/70 bg-background/70 p-4">
                          <div className="mt-1 h-4 w-4 rounded-full border-2 border-primary bg-primary" />
                          <div>
                            <div className="font-medium">In-page card form</div>
                            <div className="text-xs text-muted-foreground">
                              {useStripeMock
                                ? 'Mock card flow enabled for development with Stripe-like behavior.'
                                : 'Enter card details directly in checkout without leaving your site.'}
                            </div>
                          </div>
                        </div>

                        {!stripePromise && !useStripeMock && (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Set <strong>VITE_STRIPE_PUBLISHABLE_KEY</strong> in client environment to enable inline card form.
                            </AlertDescription>
                          </Alert>
                        )}

                        {!stripePromise && useStripeMock && (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Mock mode is active. This simulates card processing via your Stripe mock backend.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}

                    {paymentMethod === 'wallet' && (
                      <div className="mt-4 space-y-3 rounded-xl border border-emerald-300/40 bg-emerald-50/40 p-5">
                        <p className="text-sm font-medium">Wallet balance: {formatLKR(walletBalance)}</p>
                        <p className="text-xs text-muted-foreground">
                          For higher-value payments, OTP confirmation is required.
                        </p>
                        {walletPendingOrderId && (
                          <>
                            <Label htmlFor="wallet-otp">Enter Wallet OTP</Label>
                            <Input
                              id="wallet-otp"
                              value={walletOtp}
                              onChange={(e) => setWalletOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="6-digit OTP"
                              inputMode="numeric"
                            />
                            {walletMockOtpHint && (
                              <p className="text-xs text-muted-foreground">Mock OTP: {walletMockOtpHint}</p>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3 mt-6">
                      <Button variant="outline" onClick={() => setStep(1)}>
                        Back
                      </Button>
                      <Button className="flex-1" onClick={() => setStep(3)}>
                        Review Order
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      Order Review
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Order Items */}
                    <div className="space-y-4">
                {validCart.map((item, i) => (
                        <div key={item.product.id || item.product._id || i} className="flex gap-4">
                          <img
                            src={item.product.image || '/placeholder.svg'}
                            alt={item.product.name}
                            className="w-16 h-16 object-cover rounded"
                          />
                          <div className="flex-1">
                            <p className="font-medium">{item.product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Qty: {item.quantity} × {formatLKR(item.product.price)}
                            </p>
                          </div>
                          <p className="font-medium">
                            {formatLKR(item.product.price * item.quantity)}
                          </p>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {/* Shipping Summary */}
                    <div>
                      <h4 className="font-medium mb-2">Shipping Address</h4>
                      <p className="text-muted-foreground text-sm">
                        {form.fullName}
                        <br />
                        {form.address}
                        <br />
                        {form.city}, {form.postalCode}
                        <br />
                        {form.phone}
                      </p>
                    </div>

                    <Separator />

                    {/* Payment Method */}
                    <div>
                      <h4 className="font-medium mb-2">Payment Method</h4>
                      <p className="text-muted-foreground text-sm">
                        {paymentMethod === 'stripe'
                          ? 'Credit / Debit Card (In-page)' 
                          : paymentMethod === 'wallet'
                            ? 'Wallet (OTP secured)'
                          : 'Cash on Delivery'}
                      </p>
                    </div>

                    {paymentMethod === 'stripe' && stripePromise && (
                      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-background p-5">
                        <Elements stripe={stripePromise}>
                          <InlineCardForm
                            onReady={handleInlineCardReady}
                            disabled={loading}
                          />
                        </Elements>
                      </div>
                    )}

                    {paymentMethod === 'stripe' && !stripePromise && useStripeMock && (
                      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-background p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Mock Card Details</p>
                          <span className="text-xs text-primary font-medium">Sandbox</span>
                        </div>

                        <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                          <p className="text-xs text-muted-foreground mb-1">Card Number</p>
                          <Input
                            value={mockCard.cardNumber}
                            onChange={(e) => setMockCard((prev) => ({ ...prev, cardNumber: formatCardNumber(e.target.value) }))}
                            placeholder="4242 4242 4242 4242"
                            inputMode="numeric"
                          />
                        </div>

                        <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                          <p className="text-xs text-muted-foreground mb-1">Card Holder</p>
                          <Input
                            value={mockCard.cardHolder}
                            onChange={(e) => setMockCard((prev) => ({ ...prev, cardHolder: e.target.value }))}
                            placeholder="John Driver"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                            <p className="text-xs text-muted-foreground mb-1">Expiry</p>
                            <Input
                              value={mockCard.expiry}
                              onChange={(e) => setMockCard((prev) => ({ ...prev, expiry: formatExpiry(e.target.value) }))}
                              placeholder="MM/YY"
                              inputMode="numeric"
                            />
                          </div>
                          <div className="rounded-lg border border-border/70 bg-background px-4 py-3">
                            <p className="text-xs text-muted-foreground mb-1">CVC</p>
                            <Input
                              value={mockCard.cvc}
                              onChange={(e) => setMockCard((prev) => ({ ...prev, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                              placeholder="123"
                              inputMode="numeric"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'wallet' && (
                      <div className="rounded-xl border border-emerald-300/40 bg-emerald-50/40 p-5 space-y-3">
                        <p className="text-sm font-medium">Wallet balance: {formatLKR(walletBalance)}</p>
                        {walletPendingOrderId && (
                          <>
                            <Label htmlFor="wallet-otp-review">Wallet OTP</Label>
                            <Input
                              id="wallet-otp-review"
                              value={walletOtp}
                              onChange={(e) => setWalletOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="Enter OTP"
                              inputMode="numeric"
                            />
                            {walletMockOtpHint && (
                              <p className="text-xs text-muted-foreground">Mock OTP: {walletMockOtpHint}</p>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    <div className="flex gap-3 mt-6">
                      <Button variant="outline" onClick={() => setStep(2)}>
                        Back
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleCheckout}
                        disabled={loading || stockIssues.length > 0}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : paymentMethod === 'stripe' ? (
                          'Pay Card Now'
                        ) : paymentMethod === 'wallet' ? (
                          walletPendingOrderId ? 'Verify OTP & Pay' : 'Pay With Wallet'
                        ) : (
                          'Place Order'
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="sticky top-4 border-0 shadow-lg overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
                  <CardTitle className="text-lg">📦 Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {/* Cart Items */}
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {validCart.map((item, i) => (
                      <motion.div 
                        key={item.product.id || item.product._id || i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-between items-start text-sm pb-3 border-b border-border/50 last:border-0"
                      >
                        <div className="flex gap-3 flex-1">
                          <img 
                            src={item.product.image || '/placeholder.svg'} 
                            alt={item.product.name}
                            className="w-10 h-10 rounded object-cover"
                          />
                          <div className="min-w-0">
                            <p className="font-medium truncate text-foreground">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <span className="font-semibold text-primary">{formatLKR(item.product.price * item.quantity)}</span>
                      </motion.div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-border/50">
                    {/* Coupon Section */}
                    {appliedCoupon ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Tag className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-medium text-green-600">{appliedCoupon.code}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={removeCoupon}
                            className="h-auto p-1 text-xs"
                          >
                            Remove
                          </Button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="mb-4 flex gap-2">
                        <Input
                          placeholder="Coupon code"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          className="text-sm"
                        />
                        <Button
                          variant="outline"
                          onClick={validateCoupon}
                          disabled={validatingCoupon}
                          size="sm"
                        >
                          {validatingCoupon ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Apply'
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="space-y-3 pt-2 border-t border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatLKR(cartTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Shipping</span>
                      {shippingLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <span className="font-medium">{formatLKR(shippingCost)}</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Tax (18%)</span>
                      <span className="font-medium">{formatLKR(taxAmount)}</span>
                    </div>
                    {shippingError && (
                      <p className="text-xs text-amber-500 col-span-2">{shippingError}</p>
                    )}
                    {discountAmount > 0 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex justify-between items-center bg-green-500/10 p-2 rounded"
                      >
                        <span className="text-sm text-green-600 font-medium">Discount</span>
                        <span className="font-semibold text-green-600">-{formatLKR(discountAmount)}</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="pt-4 border-t border-border/50 bg-gradient-to-r from-primary/5 to-transparent -mx-6 px-6 py-4 -mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-semibold">Total Amount</span>
                      <span className="text-2xl font-bold text-primary">{formatLKR(finalTotal)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">✓ Secure & encrypted checkout</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
