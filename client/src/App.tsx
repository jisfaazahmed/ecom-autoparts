import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { useAuthStore } from "@/store/useAuthStore";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Shop from "./pages/Shop";
import Categories from "./pages/Categories";
import Deals from "./pages/Deals";
import Cart from "./pages/Cart";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import Orders from "./pages/Orders";
import MyVehicle from "./pages/MyVehicle";
import Profile from "./pages/Profile";
import CustomerAuth from "./pages/auth/CustomerAuth";
import SellerAuth from "./pages/auth/SellerAuth";
import AdminAuth from "./pages/auth/AdminAuth";
import ResetPassword from "./pages/auth/ResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import AdminProducts from "./pages/admin/Products";
import AdminOrders from "./pages/admin/Orders";
import AdminSettings from "./pages/admin/Settings";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminVendors from "./pages/superadmin/Vendors";
import SuperAdminAnalytics from "./pages/superadmin/Analytics";
import SuperAdminVehicles from "./pages/superadmin/Vehicles";
import SuperAdminCategories from "./pages/superadmin/Categories";
import SuperAdminCoupons from "./pages/superadmin/Coupons";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Initializes auth state on app mount (replaces the old AuthProvider useEffect)
const AuthInitializer = () => {
  useEffect(() => {
    useAuthStore.getState().initAuth();
  }, []);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <AuthInitializer />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/auth/customer" element={<CustomerAuth />} />
            <Route path="/auth/seller" element={<SellerAuth />} />
            <Route path="/auth/admin" element={<AdminAuth />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            
            {/* Protected customer routes */}
            <Route path="/cart" element={
              <ProtectedRoute>
                <Cart />
              </ProtectedRoute>
            } />
            <Route path="/checkout" element={
              <ProtectedRoute>
                <Checkout />
              </ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            } />
            <Route path="/my-vehicle" element={
              <ProtectedRoute>
                <MyVehicle />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/payment/success" element={
              <ProtectedRoute>
                <PaymentSuccess />
              </ProtectedRoute>
            } />
            <Route path="/payment/cancel" element={
              <ProtectedRoute>
                <PaymentCancel />
              </ProtectedRoute>
            } />
            
            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="admin" requireApprovedShop>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/products" element={
              <ProtectedRoute requiredRole="admin" requireApprovedShop>
                <AdminProducts />
              </ProtectedRoute>
            } />
            <Route path="/admin/orders" element={
              <ProtectedRoute requiredRole="admin" requireApprovedShop>
                <AdminOrders />
              </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute requiredRole="admin" requireApprovedShop>
                <AdminSettings />
              </ProtectedRoute>
            } />
            
            {/* Super Admin routes */}
            <Route path="/superadmin" element={
              <ProtectedRoute requiredRole="superadmin">
                <SuperAdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/vendors" element={
              <ProtectedRoute requiredRole="superadmin">
                <SuperAdminVendors />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/analytics" element={
              <ProtectedRoute requiredRole="superadmin">
                <SuperAdminAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/vehicles" element={
              <ProtectedRoute requiredRole="superadmin">
                <SuperAdminVehicles />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/categories" element={
              <ProtectedRoute requiredRole="superadmin">
                <SuperAdminCategories />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/coupons" element={
              <ProtectedRoute requiredRole="superadmin">
                <SuperAdminCoupons />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
