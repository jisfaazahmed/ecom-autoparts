import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { api } from "@/lib/api";
import { Shield, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const resetRequestSchema = z.object({
  email: z.string().trim().min(1, "Please enter your email address").email("Please enter a valid email address"),
});

const newPasswordSchema = z
  .string()
  .trim()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token');
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Request reset state
  const [email, setEmail] = useState("");
  const [resetRequested, setResetRequested] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail) {
      setError("Please enter your email address");

      return;
    }

    if (!emailRegex.test(normalizedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const response = await api.forgotPassword(normalizedEmail);
      setResetMessage(response.message);
      setResetRequested(true);
      toast.success(response.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    }

    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const normalizedConfirmPassword = confirmPassword.trim();

    if (!normalizedConfirmPassword) {
      setError("Please confirm your new password");
      return;
    }

    const newPasswordValidation = newPasswordSchema.safeParse(password);
    if (!newPasswordValidation.success) {
      setError(newPasswordValidation.error.issues[0]?.message || "Invalid password");
      return;
    }

    const normalizedPassword = newPasswordValidation.data;

    if (normalizedPassword !== normalizedConfirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!resetToken) {
      setError("Invalid reset link");
      return;
    }

    setLoading(true);

    try {
      await api.resetPassword(resetToken, normalizedPassword, normalizedConfirmPassword);
      toast.success("Password updated successfully!");
      navigate("/auth/customer");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    }

    setLoading(false);
  };

  // If we have a reset token, show the password reset form
  if (resetToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
        {/* Theme Toggle */}
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse-glow" />
        
        <Card className="relative w-full max-w-md border-border/50 glass-card shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
              <CardDescription className="mt-2">
                Enter your new password below
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleResetPassword} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show reset requested confirmation
  if (resetRequested) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
        {/* Theme Toggle */}
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>
        
        <div className="absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-success/20 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
        
        <Card className="relative w-full max-w-md border-border/50 glass-card shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
              <Mail className="h-8 w-8 text-success" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
              <CardDescription className="mt-2">
                {resetMessage || "If an account with this email exists, a password reset link will be sent."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Didn't receive the email? Check your spam folder or try again.
            </p>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setResetRequested(false)}
            >
              Try Again
            </Button>
            <Button 
              variant="ghost" 
              className="w-full"
              onClick={() => navigate("/auth/customer")}
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show request reset form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse-glow" />
      
      <Card className="relative w-full max-w-md border-border/50 glass-card shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Forgot Password?</CardTitle>
            <CardDescription className="mt-2">
              Enter your email address and we'll send you reset instructions
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleRequestReset} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>

            <Button 
              type="button"
              variant="ghost" 
              className="w-full"
              onClick={() => navigate("/auth/customer")}
            >
              Back to Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
