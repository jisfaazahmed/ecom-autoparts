import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Shop from "./pages/Shop";
import Categories from "./pages/Categories";
import Deals from "./pages/Deals";
import Cart from "./pages/Cart";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentDownload from "./pages/PaymentDownload";
import PaymentCancel from "./pages/PaymentCancel";
import Orders from "./pages/Orders";
import ReturnsRefunds from "./pages/ReturnsRefunds";
import MyVehicle from "./pages/MyVehicle";
import Profile from "./pages/Profile";
import Wallet from "./pages/Wallet";
import TrackOrder from "./pages/TrackOrder";
import CustomerAuth from "./pages/auth/CustomerAuth";
import SellerAuth from "./pages/auth/SellerAuth";
import AdminAuth from "./pages/auth/AdminAuth";
import ResetPassword from "./pages/auth/ResetPassword";
import AdminDashboard from "./pages/AdminDashboard";
import AdminProducts from "./pages/admin/Products";
import AdminOrders from "./pages/admin/Orders";
import AdminRefunds from "./pages/admin/Refunds";
import AdminSettings from "./pages/admin/Settings";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminVendors from "./pages/superadmin/Vendors";
import SuperAdminAnalytics from "./pages/superadmin/Analytics";
import SuperAdminProducts from "./pages/superadmin/Products";
import SuperAdminVehicles from "./pages/superadmin/Vehicles";
import SuperAdminCategories from "./pages/superadmin/Categories";
import SuperAdminCoupons from "./pages/superadmin/Coupons";
import SuperAdminPolicies from "./pages/superadmin/Policies";
import Wishlist from "./pages/Wishlist";
import Compare from "./pages/Compare";
import AdminCustomers from "./pages/admin/Customers";
import AdminPayouts from "./pages/admin/Payouts";
import SuperAdminSettlements from "./pages/superadmin/Settlements";
import ReturnPolicy from "./pages/ReturnPolicy";
import ShippingPolicy from "./pages/ShippingPolicy";
import CancellationPolicy from "./pages/CancellationPolicy";
import TermsConditions from "./pages/TermsConditions";
import NotFound from "./pages/NotFound";
import NotificationToast from "@/components/notifications/NotificationToast";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <NotificationToast />
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
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            } />
            <Route path="/returns" element={
              <ProtectedRoute>
                <ReturnsRefunds />
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
            <Route path="/wallet" element={
              <ProtectedRoute>
                <Wallet />
              </ProtectedRoute>
            } />
            <Route path="/wishlist" element={
              <ProtectedRoute>
                <Wishlist />
              </ProtectedRoute>
            } />
            <Route path="/compare" element={<Compare />} />
          
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/download" element={<PaymentDownload />} />
            <Route path="/payment/cancel" element={
              <ProtectedRoute>
                <PaymentCancel />
              </ProtectedRoute>
            } />
            <Route path="/track-order" element={<TrackOrder />} />
            
            {/* Policy pages */}
            <Route path="/policy/return" element={<ReturnPolicy />} />
            <Route path="/policy/shipping" element={<ShippingPolicy />} />
            <Route path="/policy/cancellation" element={<CancellationPolicy />} />
            <Route path="/policy/terms" element={<TermsConditions />} />
            
            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/products" element={
              <ProtectedRoute requiredRole="admin">
                <AdminProducts />
              </ProtectedRoute>
            } />
            <Route path="/admin/orders" element={
              <ProtectedRoute requiredRole="admin">
                <AdminOrders />
              </ProtectedRoute>
            } />
            <Route path="/admin/refunds" element={
              <ProtectedRoute requiredRole="admin">
                <AdminRefunds />
              </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute requiredRole="admin">
                <AdminSettings />
              </ProtectedRoute>
            } />
            <Route path="/admin/customers" element={
              <ProtectedRoute requiredRole="admin" requireApprovedShop>
                <AdminCustomers />
              </ProtectedRoute>
            } />
            <Route path="/admin/payouts" element={
              <ProtectedRoute requiredRole="admin" requireApprovedShop>
                <AdminPayouts />
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
            <Route path="/superadmin/products" element={
              <ProtectedRoute requiredRole="superadmin">
                <SuperAdminProducts />
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
            <Route path="/superadmin/policies" element={
              <ProtectedRoute requiredRole="superadmin">
                <SuperAdminPolicies />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/refunds" element={
              <ProtectedRoute requiredRole="superadmin">
                <AdminRefunds />
              </ProtectedRoute>
            } />
            <Route path="/superadmin/settlements" element={
              <ProtectedRoute requiredRole="superadmin">
                <SuperAdminSettlements />
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