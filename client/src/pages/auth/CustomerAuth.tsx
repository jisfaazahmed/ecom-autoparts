import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, Mail, Lock, User, Phone, MapPin, Eye, EyeOff, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { isValidSriLankanPhone, normalizeSriLankanPhone } from '@/lib/sriLankaValidation';

const loginSchema = z.object({
  email: z.string().trim().min(1, "Please enter your email address").email('Invalid email address'),
  password: z.string().trim().min(8, 'Password must be at least 8 characters'),
});

// Phone and address stay optional, but when filled in they are held to the same rules
// the Profile page enforces on save — otherwise a number accepted here is rejected the
// first time the customer edits their profile.
const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().min(1, "Please enter your email address").email('Invalid email address'),
  password: z
  .string()
  .trim()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

const CustomerAuth: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, verifySignupOtp, resendSignupOtp, user } = useAuth();

  const role = user?.role;
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
    address: '',
  });

  // Redirect if already logged in
  useEffect(() => {
    if (user && role) {
      const from = (location.state)?.from?.pathname || '/';
      if (role === 'superadmin') {
        navigate('/superadmin');
      } else if (role === 'admin') {
        navigate('/admin');
      } else {
        navigate(from);
      }
    }
  }, [user, role, navigate, location]);

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
    const { error } = await signIn(loginForm.email, loginForm.password);
    setLoading(false);

    if (error) {
      toast({
        title: 'Login Failed',
        description: error.message || 'Invalid email or password.',
        variant: 'destructive',
      });
      return;
    }

    // Redirect is handled by the useEffect when user/role state updates.
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
    const { error, verificationId } = await signUp({
      email: signupForm.email,
      password: signupForm.password,
      fullName: signupForm.fullName,
      // Store the canonical 07XXXXXXXX form, matching what Profile saves.
      phone: signupForm.phone ? normalizeSriLankanPhone(signupForm.phone) : undefined,
      address: signupForm.address.trim() || undefined,
    });
    setLoading(false);
    if (error) {
      toast({
        title: 'Signup Failed',
        description: error.message || 'Unable to create account.',
        variant: 'destructive',
      });
      return;
    }

    if (verificationId) {
      setPendingVerificationId(verificationId);
      toast({
        title: 'Check your email',
        description: 'We sent a 6-digit OTP to verify your email.',
      });
      return;
    }
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

    const from = (location.state)?.from?.pathname || '/';
    navigate(from);
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
        className="relative w-full max-w-md"
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
          <p className="text-muted-foreground mt-2">Customer Portal</p>
        </div>

        <div className="glass-card rounded-2xl p-8 border border-border/50 shadow-2xl">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
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

                <div className="text-right">
                  <Link to="/auth/reset-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              {!pendingVerificationId ? (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name *</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Smith"
                        className="pl-10"
                        value={signupForm.fullName}
                        onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                      />
                    </div>
                    {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
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

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create Account
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-otp">Email OTP</Label>
                    <Input
                      id="signup-otp"
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
                    Verify & Continue
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
            Want to sell on AutoMatrix?{' '}
            <Link to="/auth/seller" className="text-primary hover:underline">
              Register as a Seller
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CustomerAuth;
