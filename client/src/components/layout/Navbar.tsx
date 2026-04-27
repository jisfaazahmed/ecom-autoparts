import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Search, ShoppingCart, User, Menu, Car, LogOut, Store, Shield, UserCircle, FileText 
} from 'lucide-react';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import NotificationBell from '@/components/notifications/NotificationBell';

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cart, userVehicle } = useStore();
  
  // Fix: map useAuth return values to what Navbar expects
  const { user, logout } = useAuth();
  const signOut = logout;
  const loading = false;
  const role = user?.role;
  const profile = user ? { full_name: user.name } : null;

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const navLinks = [
    { href: '/shop', label: 'Shop' },
    { href: '/categories', label: 'Categories' },
    { href: '/deals', label: 'Deals' },
  ];

  const policyLinks = [
    { href: '/policy/return', label: 'Return Policy' },
    { href: '/policy/shipping', label: 'Shipping Policy' },
    { href: '/policy/cancellation', label: 'Cancellation Policy' },
    { href: '/policy/terms', label: 'Terms & Conditions' },
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="sticky top-0 z-50 w-full border-b border-border/50 glass-card"
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
            <Car className="relative h-8 w-8 text-primary" />
          </div>
          <span className="font-display text-xl font-bold tracking-wider text-foreground">
            AUTO<span className="text-primary">MATRIX</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`text-sm font-medium transition-colors ${location.pathname === link.href ? 'text-primary' : 'text-muted-foreground hover:text-black dark:hover:text-black font-semibold'}`}
            >
              {link.label}
            </Link>
          ))}
          
          {/* Policies Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-sm font-medium text-muted-foreground hover:text-black dark:hover:text-black hover:font-semibold transition-all">
                <FileText className="h-4 w-4 mr-1" />
                Policies
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="glass-card border-border/50 w-48">
              {policyLinks.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  <Link to={link.href} className="w-full">
                    {link.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Search Bar */}
        <div className="hidden lg:flex flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search parts, brands, or categories..."
              className="pl-10 bg-secondary/50 border-border/50 focus:border-primary"
            />
          </div>
        </div>

        {/* Vehicle Badge */}
        {userVehicle && (
          <Link to="/my-vehicle">
            <Badge variant="outline" className="hidden md:flex items-center gap-2 border-primary/50 text-primary">
              <Car className="h-3 w-3" />
              {userVehicle.year} {userVehicle.brand} {userVehicle.model}
            </Badge>
          </Link>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          {user && <NotificationBell />}
          
          {/* Cart */}
          <Link to="/cart">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold"
                >
                  {cartCount}
                </motion.span>
              )}
            </Button>
          </Link>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 glass-card border-border/50">
              {loading ? (
                <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                  Loading...
                </div>
              ) : user ? (
                <>
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{profile?.full_name || user.email}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    {role && (
                      <Badge variant="outline" className="mt-1 text-xs capitalize">
                        {role}
                      </Badge>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile">My Profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/my-vehicle">My Vehicle</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/orders">My Orders</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/returns">Returns & Refunds</Link>
                  </DropdownMenuItem>
                  {role === 'admin' && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin">Admin Dashboard</Link>
                    </DropdownMenuItem>
                  )}
                  {role === 'superadmin' && (
                    <DropdownMenuItem asChild>
                      <Link to="/superadmin">Super Admin</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/auth/customer" className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4" />
                      Customer Login
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/auth/seller" className="flex items-center gap-2">
                      <Store className="h-4 w-4" />
                      Seller Portal
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/auth/admin" className="flex items-center gap-2 text-muted-foreground">
                      <Shield className="h-4 w-4" />
                      Admin Login
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="glass-card border-border/50">
              <nav className="flex flex-col gap-4 mt-8">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="text-lg font-medium transition-all hover:text-black dark:hover:text-black hover:font-bold"
                  >
                    {link.label}
                  </Link>
                ))}
                
                {/* Mobile Policies Section */}
                <DropdownMenuSeparator />
                <div className="text-lg font-medium text-primary flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5" />
                  Policies
                </div>
                {policyLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="text-sm text-muted-foreground hover:text-black dark:hover:text-black hover:font-semibold transition-all pl-7"
                  >
                    {link.label}
                  </Link>
                ))}
                
                <DropdownMenuSeparator />
                {user ? (
                  <>
                    <Link to="/orders" className="text-lg font-medium transition-all hover:text-black dark:hover:text-black hover:font-bold">
                      My Orders
                    </Link>
                    <Link to="/returns" className="text-lg font-medium transition-all hover:text-black dark:hover:text-black hover:font-bold">
                      Returns & Refunds
                    </Link>
                    {role === 'admin' && (
                      <Link to="/admin" className="text-lg font-medium transition-colors hover:text-primary">
                        Admin Dashboard
                      </Link>
                    )}
                    {role === 'superadmin' && (
                      <Link to="/superadmin" className="text-lg font-medium transition-colors hover:text-primary">
                        Super Admin
                      </Link>
                    )}
                    <button
                      onClick={handleSignOut}
                      className="text-lg font-medium text-destructive text-left"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/auth/customer" className="text-lg font-medium transition-colors hover:text-primary flex items-center gap-2">
                      <UserCircle className="h-5 w-5" />
                      Customer Login
                    </Link>
                    <Link to="/auth/seller" className="text-lg font-medium transition-colors hover:text-primary flex items-center gap-2">
                      <Store className="h-5 w-5" />
                      Seller Portal
                    </Link>
                    <Link to="/auth/admin" className="text-lg font-medium transition-colors hover:text-primary text-muted-foreground flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Admin Login
                    </Link>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.header>
  );
};

export default Navbar;
