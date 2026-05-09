import { ReactNode, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('customer' | 'admin' | 'superadmin')[];
  requiredRole?: 'customer' | 'admin' | 'superadmin';
  requireApprovedShop?: boolean;
}

const ProtectedRoute = ({ 
  children, 
  allowedRoles,
  requiredRole,
  requireApprovedShop = false 
}: ProtectedRouteProps) => {
  const { user, role, shop, loading, refreshProfile } = useAuth();
  const location = useLocation();
  const [checkingApproval, setCheckingApproval] = useState(false);
  const checkedOnceRef = useRef(false);

  useEffect(() => {
    if (!requireApprovedShop || loading) return;
    if (!user || !shop || shop.status !== 'pending') return;
    if (checkedOnceRef.current) return;

    checkedOnceRef.current = true;
    const runRefresh = async () => {
      setCheckingApproval(true);
      await refreshProfile();
      setCheckingApproval(false);
    };

    runRefresh();
  }, [requireApprovedShop, loading, user, shop, refreshProfile]);

  const handleCheckApproval = async () => {
    if (checkingApproval) return;
    setCheckingApproval(true);
    await refreshProfile();
    setCheckingApproval(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/customer" state={{ from: location }} replace />;
  }

  // Check requiredRole - superadmin can access all, admin can access admin routes
  if (requiredRole) {
    if (requiredRole === 'superadmin' && role !== 'superadmin') {
      return <Navigate to="/" replace />;
    }
    if (requiredRole === 'admin' && role !== 'admin' && role !== 'superadmin') {
      return <Navigate to="/" replace />;
    }
  }

  if (allowedRoles && role && !allowedRoles.includes(role as any)) {
    return <Navigate to="/" replace />;
  }

  if (requireApprovedShop && shop?.status !== 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 glass-card rounded-xl max-w-md">
          <h2 className="text-xl font-bold text-foreground mb-2">Shop Pending Approval</h2>
          <p className="text-muted-foreground">
            Your shop is currently under review. You'll get access once approved.
          </p>
          <div className="mt-6">
            <Button onClick={handleCheckApproval} disabled={checkingApproval}>
              {checkingApproval ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Check approval status
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
