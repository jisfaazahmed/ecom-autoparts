import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

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
  const { user, role, shop, loading } = useAuth();
  const location = useLocation();

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

  if (allowedRoles && role && !allowedRoles.includes(role)) {
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
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
