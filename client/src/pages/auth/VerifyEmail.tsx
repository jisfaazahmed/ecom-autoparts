import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, Mail, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/lib/api';

type VerificationStep = 'verifying' | 'success' | 'error' | 'resend';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  
  const [step, setStep] = useState<VerificationStep>('verifying');
  const [loading, setLoading] = useState(false);
  const [resendEmail, setResendEmail] = useState(email || '');
  const [countdown, setCountdown] = useState(0);
  const verificationStartedRef = useRef(false);
  const redirectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!token || verificationStartedRef.current) {
      return;
    }

    verificationStartedRef.current = true;
    void verifyEmail(token);
  }, [token]);

  useEffect(() => {
    if (step !== 'success') {
      return;
    }

    redirectTimeoutRef.current = window.setTimeout(() => {
      navigate('/auth/customer', { state: { emailVerified: true } });
    }, 2000);

    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [step, navigate]);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const verifyEmail = async (verificationToken: string) => {
    if (!verificationToken) {
      setStep('error');
      return;
    }

    try {
      await api.verifyEmail(verificationToken);
      setStep('success');
    } catch (error) {
      console.error('Email verification failed:', error);
      setStep('error');
    }
  };

  const handleResendEmail = async () => {
    if (!resendEmail) {
      toast({
        title: 'Error',
        description: 'Please enter your email address',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await api.resendVerificationEmail(resendEmail);
      toast({
        title: 'Email Sent',
        description: 'Verification email has been resent. Check your inbox.',
      });
      setCountdown(60);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resend verification email';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
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
          <Link to="/" className="inline-flex items-center gap-2 justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
              <Car className="relative h-10 w-10 text-primary" />
            </div>
            <span className="font-display text-2xl font-bold tracking-wider text-foreground">
              AUTO<span className="text-primary">MATRIX</span>
            </span>
          </Link>
          <p className="text-muted-foreground mt-2">Email Verification</p>
        </div>

        <div className="glass-card rounded-2xl p-8 border border-border/50 shadow-2xl">
          {step === 'verifying' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center space-y-4"
            >
              <div className="flex justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Email Verification in Progress</h2>
              <p className="text-muted-foreground">
                Please wait while we confirm your email address and activate your account.
              </p>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4"
            >
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">Email Verified!</h2>
              <p className="text-muted-foreground">
                Your email has been successfully verified. Redirecting to login...
              </p>
              <div className="pt-4">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              </div>
            </motion.div>
          )}

          {step === 'error' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6"
            >
              <div className="flex justify-center">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-foreground">Verification Failed</h2>
                <p className="text-muted-foreground">
                  {token ? 'The verification link is invalid or has expired.' : 'No verification token provided.'}
                </p>
              </div>

              <Button
                onClick={() => setStep('resend')}
                variant="outline"
                className="w-full"
              >
                Resend Verification Email
              </Button>

              <Link to="/auth/customer">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </Link>
            </motion.div>
          )}

          {step === 'resend' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="flex justify-center">
                  <Mail className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">Resend Verification</h2>
                <p className="text-sm text-muted-foreground">
                  Enter your email address and we'll send you a new verification link.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resend-email">Email Address</Label>
                  <Input
                    id="resend-email"
                    type="email"
                    placeholder="your@email.com"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleResendEmail}
                  className="w-full"
                  disabled={loading || countdown > 0}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : countdown > 0 ? (
                    `Resend in ${countdown}s`
                  ) : (
                    'Send Verification Email'
                  )}
                </Button>

                <Link to="/auth/customer">
                  <Button variant="ghost" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Login
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default VerifyEmail;
