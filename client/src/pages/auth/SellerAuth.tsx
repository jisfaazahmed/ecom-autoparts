import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, Mail, Lock, User, Phone, Store, FileText, Eye, EyeOff, Loader2, MapPin } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(9, 'Valid phone number required'),
  shopName: z.string().min(2, 'Shop name must be at least 2 characters'),
  businessRegistration: z.string().optional(),
  shopDescription: z.string().optional(),
  shopAddress: z.string().optional(),
});

const SellerAuth: React.FC = () => {
  const navigate = useNavigate();
  const { signIn, signUpSeller, verifySignupOtp, resendSignupOtp, user, role } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingVerificationId, setPendingVerificationId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    shopName: '',
    businessRegistration: '',
    shopDescription: '',
    shopAddress: '',
  });

  // Redirect if already logged in
  React.useEffect(() => {
    if (user && role) {
      if (role === 'superadmin') {
        navigate('/superadmin');
      } else if (role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    }
  }, [user, role, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      loginSchema.parse(loginForm);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) fieldErrors[error.path[0].toString()] = error.message;
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setLoading(true);
    const { error } = await signIn(loginForm.email.trim(), loginForm.password);

    if (error) {
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid credentials',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Redirect will happen via useEffect when role updates
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      signupSchema.parse(signupForm);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) fieldErrors[error.path[0].toString()] = error.message;
        });
        setErrors(fieldErrors);
        return;
      }
    }

    setLoading(true);
    
    const { error, verificationId } = await signUpSeller({
      email: signupForm.email.trim(),
      password: signupForm.password,
      fullName: signupForm.fullName,
      shopName: signupForm.shopName,
      businessRegistration: signupForm.businessRegistration || undefined,
      shopDescription: signupForm.shopDescription || undefined,
      phone: signupForm.phone,
      address: signupForm.shopAddress || undefined,
    });

    if (error) {
      toast({
        title: 'Registration Failed',
        description: error.message || 'Unable to register seller account.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    if (verificationId) {
      setPendingVerificationId(verificationId);
      toast({
        title: 'Verify your email',
        description: 'We sent a 6-digit OTP to your email address.',
      });
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingVerificationId) return;

    setLoading(true);
    const { error } = await verifySignupOtp({ verificationId: pendingVerificationId, otp });
    setLoading(false);

    if (error) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid or expired OTP.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Application Submitted',
      description: 'Your seller application is pending approval.',
    });
    navigate('/admin');
  };

  const handleResendOtp = async () => {
    if (!pendingVerificationId) return;
    setLoading(true);
    const { error } = await resendSignupOtp({ verificationId: pendingVerificationId });
    setLoading(false);
    if (error) {
      toast({
        title: 'Could not resend',
        description: error.message || 'Please try again shortly.',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'OTP resent', description: 'Check your email for the new code.' });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse-glow" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-lg"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
              <Car className="relative h-10 w-10 text-primary" />
            </div>
            <span className="font-display text-2xl font-bold tracking-wider text-foreground">
              AUTO<span className="text-primary">MATRIX</span>
            </span>
          </Link>
          <p className="text-muted-foreground mt-2">Seller Portal</p>
        </div>

        <div className="glass-card rounded-2xl p-8 border border-border/50 shadow-2xl">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="register">Register Shop</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="your@email.com"
                      className="pl-10"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      value={loginForm.password}
                      onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Sign In 
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              {!pendingVerificationId ? (
                <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Your Name"
                        className="pl-10"
                        value={signupForm.fullName}
                        onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                      />
                    </div>
                    {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Phone *</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="+94 XX XXX XXXX"
                        className="pl-10"
                        value={signupForm.phone}
                        onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                      />
                    </div>
                    {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="your@email.com"
                      className="pl-10"
                      value={signupForm.email}
                      onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className="pl-10 pr-10"
                      value={signupForm.password}
                      onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                </div>

                <div className="border-t border-border/50 pt-4 mt-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <Store className="h-4 w-4 text-primary" />
                    Shop Details
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="shop-name">Shop/Business Name *</Label>
                      <div className="relative">
                        <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="shop-name"
                          type="text"
                          placeholder="Your Auto Parts Shop"
                          className="pl-10"
                          value={signupForm.shopName}
                          onChange={(e) => setSignupForm({ ...signupForm, shopName: e.target.value })}
                        />
                      </div>
                      {errors.shopName && <p className="text-sm text-destructive">{errors.shopName}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="business-reg">Business Registration Number</Label>
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="business-reg"
                          type="text"
                          placeholder="BR-XXXXXX"
                          className="pl-10"
                          value={signupForm.businessRegistration}
                          onChange={(e) => setSignupForm({ ...signupForm, businessRegistration: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shop-address">Shop Address</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="shop-address"
                          type="text"
                          placeholder="123 Main Street, Colombo"
                          className="pl-10"
                          value={signupForm.shopAddress}
                          onChange={(e) => setSignupForm({ ...signupForm, shopAddress: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="shop-desc">Shop Description</Label>
                      <Textarea
                        id="shop-desc"
                        placeholder="Tell customers about your shop..."
                        rows={3}
                        value={signupForm.shopDescription}
                        onChange={(e) => setSignupForm({ ...signupForm, shopDescription: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Submit Application
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  By registering, you agree to our Terms of Service. Your shop will be reviewed within 24-48 hours.
                </p>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="seller-otp">Email OTP</Label>
                    <Input
                      id="seller-otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter 6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter the code sent to <span className="font-medium">{signupForm.email}</span>.
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Verify & Submit
                  </Button>

                  <Button type="button" variant="outline" className="w-full" onClick={handleResendOtp} disabled={loading}>
                    Resend code
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setPendingVerificationId(null);
                      setOtp('');
                    }}
                    disabled={loading}
                  >
                    Back
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Looking to buy parts?{' '}
            <Link to="/auth/customer" className="text-primary hover:underline">
              Customer Sign In
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default SellerAuth;
