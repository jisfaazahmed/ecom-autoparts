import { useState, useEffect, useCallback } from 'react';
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
import { useStore } from '@/store/useStore';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiCoupon } from '@/lib/api';
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
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'cod'>('stripe');
  const [cardFlow, setCardFlow] = useState<'inline' | 'redirect'>((stripePromise || useStripeMock) ? 'inline' : 'redirect');
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
      }));
    }
  }, [user]);

  const cartTotal = getCartTotal();
  const finalTotal = cartTotal + shippingCost - discountAmount;
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

    const district = form.city.trim();
    if (!district) {
      setShippingCost(DEFAULT_SHIPPING_COST);
      setShippingError(null);
      return;
    }

    // Shipping calculation endpoint is authenticated in backend. For guests we use a fallback estimate.
    if (!api.getToken()) {
      setShippingCost(DEFAULT_SHIPPING_COST);
      setShippingError('Sign in to get exact shipping cost for your address.');
      return;
    }

    setShippingLoading(true);
    try {
      const quote = await api.calculateShipping({
        items: validCart.map((item) => ({
          product: {
            price: item.product.price,
            weight: item.product.weight,
          },
          quantity: item.quantity,
        })),
        deliveryAddress: {
          district,
          city: form.city.trim(),
        },
        shippingMethod: 'standard',
      });

      setShippingCost(typeof quote.totalCharge === 'number' ? quote.totalCharge : DEFAULT_SHIPPING_COST);
      setShippingError(null);
    } catch (error) {
      console.error('Shipping calculation failed:', error);
      setShippingCost(DEFAULT_SHIPPING_COST);
      setShippingError('Using estimated shipping cost. Exact charge will apply at fulfillment.');
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

  const handleStripeCheckout = async () => {
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

      // First create the order
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

      // Then create checkout session with the orderId
      const result = await api.createCheckoutSession({
        orderId: order.id,
      });

      // Redirect to Stripe Checkout
      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to create checkout session');
    } finally {
      setLoading(false);
    }
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

  const handleCheckout = () => {
    if (paymentMethod === 'stripe') {
      if (cardFlow === 'inline') {
        handleInlineCardCheckout();
      } else {
        handleStripeCheckout();
      }
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
    <div className="min-h-screen bg-background py-8">
      <div className="container max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">Checkout</h1>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {steps.map((s, index) => (
            <div key={s.number} className="flex items-center">
              <div
                className={`
                  flex items-center justify-center w-10 h-10 rounded-full border-2
                  ${step >= s.number
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground/25 text-muted-foreground'}
                `}
              >
                <s.icon className="h-5 w-5" />
              </div>
              <span
                className={`ml-2 text-sm font-medium ${
                  step >= s.number ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {s.title}
              </span>
              {index < steps.length - 1 && (
                <div
                  className={`w-16 h-0.5 mx-4 ${
                    step > s.number ? 'bg-primary' : 'bg-muted-foreground/25'
                  }`}
                />
              )}
            </div>
          ))}
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
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Payment Method
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RadioGroup
                      value={paymentMethod}
                      onValueChange={(v) => setPaymentMethod(v as 'stripe' | 'cod')}
                      className="space-y-4"
                    >
                      <div
                        className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                          paymentMethod === 'stripe' ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                        onClick={() => setPaymentMethod('stripe')}
                      >
                        <RadioGroupItem value="stripe" id="stripe" />
                        <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                          <div className="font-medium">Credit / Debit Card</div>
                          <div className="text-sm text-muted-foreground">
                            Secure payment via Stripe
                          </div>
                        </Label>
                        <div className="flex gap-2">
                          <img src="/visa.svg" alt="Visa" className="h-6" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          <img src="/mastercard.svg" alt="Mastercard" className="h-6" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        </div>
                      </div>

                      <div
                        className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                          paymentMethod === 'cod' ? 'border-primary bg-primary/5' : 'border-border'
                        }`}
                        onClick={() => setPaymentMethod('cod')}
                      >
                        <RadioGroupItem value="cod" id="cod" />
                        <Label htmlFor="cod" className="flex-1 cursor-pointer">
                          <div className="font-medium">Cash on Delivery</div>
                          <div className="text-sm text-muted-foreground">
                            Pay when you receive your order
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>

                    {paymentMethod === 'stripe' && (
                      <div className="mt-4 space-y-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Card Processing Method</p>
                          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            PCI-ready flow
                          </div>
                        </div>
                        <RadioGroup
                          value={cardFlow}
                          onValueChange={(v) => setCardFlow(v as 'inline' | 'redirect')}
                          className="space-y-3"
                        >
                          <div className="flex items-start space-x-3 rounded-lg border border-border/70 bg-background/70 p-4">
                            <RadioGroupItem value="inline" id="inline-card" disabled={!stripePromise && !useStripeMock} />
                            <Label htmlFor="inline-card" className="cursor-pointer">
                              <div className="font-medium">Add card here (inline form)</div>
                              <div className="text-xs text-muted-foreground">
                                {useStripeMock
                                  ? 'Mock card flow enabled for development with Stripe-like behavior.'
                                  : 'Enter card in checkout and pay without redirect.'}
                              </div>
                            </Label>
                          </div>

                          <div className="flex items-start space-x-3 rounded-lg border border-border/70 bg-background/70 p-4">
                            <RadioGroupItem value="redirect" id="redirect-card" />
                            <Label htmlFor="redirect-card" className="cursor-pointer">
                              <div className="font-medium">Stripe hosted checkout</div>
                              <div className="text-xs text-muted-foreground">
                                Redirect to Stripe page to add card and pay.
                              </div>
                            </Label>
                          </div>
                        </RadioGroup>

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
                          ? cardFlow === 'inline'
                            ? 'Credit / Debit Card (Stripe inline)'
                            : 'Credit / Debit Card (Stripe hosted checkout)'
                          : 'Cash on Delivery'}
                      </p>
                    </div>

                    {paymentMethod === 'stripe' && cardFlow === 'inline' && stripePromise && (
                      <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-background p-5">
                        <Elements stripe={stripePromise}>
                          <InlineCardForm
                            onReady={handleInlineCardReady}
                            disabled={loading}
                          />
                        </Elements>
                      </div>
                    )}

                    {paymentMethod === 'stripe' && cardFlow === 'inline' && !stripePromise && useStripeMock && (
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
                          cardFlow === 'inline' ? 'Pay Card Now' : 'Pay with Stripe'
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
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Cart Items */}
                <div className="space-y-3">
                  {validCart.map((item, i) => (
                    <div key={item.product.id || item.product._id || i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.product.name} × {item.quantity}
                      </span>
                      <span>{formatLKR(item.product.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Coupon */}
                <div>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">{appliedCoupon.code}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeCoupon}
                        className="h-auto p-1"
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Coupon code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      />
                      <Button
                        variant="outline"
                        onClick={validateCoupon}
                        disabled={validatingCoupon}
                      >
                        {validatingCoupon ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Apply'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                <Separator />

                {/* Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatLKR(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Shipping</span>
                    <span>{shippingLoading ? 'Calculating...' : formatLKR(shippingCost)}</span>
                  </div>
                  {shippingError && (
                    <p className="text-xs text-amber-500">{shippingError}</p>
                  )}
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-500">
                      <span>Discount</span>
                      <span>-{formatLKR(discountAmount)}</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span>{formatLKR(finalTotal)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
