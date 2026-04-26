import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Search, ShoppingCart, User, Menu, Car, LogOut, Store, Shield, UserCircle, Star, ChevronDown 
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
import { api, ApiUserVehicle } from '@/lib/api';

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cart, getCartCount, userVehicle, setUserVehicle, vehicleRefreshKey } = useStore();
  const { user, profile, role, signOut, loading } = useAuth();
  const cartCount = getCartCount();
  const [searchQuery, setSearchQuery] = useState('');
  const [savedVehicles, setSavedVehicles] = useState<ApiUserVehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);

  const navLinks = [
    { href: '/shop', label: 'Shop' },
    { href: '/categories', label: 'Categories' },
    { href: '/deals', label: 'Deals' },
  ];

  const fetchSavedVehicles = useCallback(async () => {
    if (!user) return;
    setVehiclesLoading(true);
    try {
      const data = await api.getUserVehicles();
      setSavedVehicles(data || []);
    } catch {
      // fail silently
    }
    setVehiclesLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSavedVehicles();
  }, [fetchSavedVehicles, vehicleRefreshKey]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchQuery(params.get('search') ?? '');
  }, [location.pathname, location.search]);

  const handleSwitchVehicle = async (vehicle: ApiUserVehicle) => {
    try {
      await api.setActiveVehicle(vehicle.id);
      setUserVehicle({
        id: vehicle.id,
        brand: vehicle.brand?.name ?? '',
        model: vehicle.model?.name ?? '',
        variant: vehicle.variant?.name ?? '',
        year: vehicle.year,
        registrationNumber: vehicle.registrationNumber,
      });
      setSavedVehicles((prev) =>
        prev.map((v) => ({ ...v, isActive: v.id === vehicle.id }))
      );
    } catch {
      // fail silently
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const nextParams = new URLSearchParams();
    const trimmedSearch = searchQuery.trim();

    // Keep active category filter when searching from the shop page.
    if (location.pathname === '/shop') {
      const currentParams = new URLSearchParams(location.search);
      const category = currentParams.get('category');
      if (category) nextParams.set('category', category);
    }

    if (trimmedSearch) {
      nextParams.set('search', trimmedSearch);
    }

    const queryString = nextParams.toString();
    navigate(`/shop${queryString ? `?${queryString}` : ''}`);
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
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location.pathname === link.href ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Search Bar */}
        <div className="hidden lg:flex flex-1 max-w-md">
          <form className="relative w-full" onSubmit={handleSearchSubmit}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search parts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-24 bg-secondary/50 border-border/50 focus:border-primary"
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 z-10">
              <Button
                type="submit"
                size="sm"
                className="neon-button h-8 px-3"
                aria-label="Search"
              >
                Search
              </Button>
            </div>
          </form>
        </div>

        {/* Vehicle Switcher */}
        {user && (
          <div className="hidden md:flex items-center">
            {savedVehicles.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 border-primary/50 text-primary hover:border-primary">
                    <Car className="h-3.5 w-3.5" />
                    {userVehicle
                      ? `${userVehicle.year} ${userVehicle.brand} ${userVehicle.model}`
                      : 'Select Vehicle'}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 glass-card border-border/50">
                  <div className="px-2 py-1.5">
                    <p className="text-xs font-medium text-muted-foreground">My Vehicles</p>
                  </div>
                  <DropdownMenuSeparator />
                  {savedVehicles.map((v) => (
                    <DropdownMenuItem
                      key={v.id}
                      onClick={() => handleSwitchVehicle(v)}
                      className="flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {`${v.brand?.name} ${v.model?.name}`}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {v.year} {v.brand?.name} {v.model?.name} {v.variant?.name}
                        </span>
                      </div>
                      {v.isActive && (
                        <Star className="h-3.5 w-3.5 text-primary fill-primary shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/my-vehicle" className="flex items-center gap-2 text-primary">
                      <Car className="h-4 w-4" />
                      Manage Vehicles
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <ThemeToggle />
          
          {/* Cart */}
          <Link to="/cart">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {user && cartCount > 0 && (
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
                    <Link to="/my-vehicle">My Vehicles</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/orders">My Orders</Link>
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
                    className="text-lg font-medium transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                ))}
                <DropdownMenuSeparator />
                {user ? (
                  <>
                    <Link to="/my-vehicle" className="text-lg font-medium transition-colors hover:text-primary flex items-center gap-2">
                      <Car className="h-5 w-5" />
                      My Vehicles
                    </Link>
                    <Link to="/orders" className="text-lg font-medium transition-colors hover:text-primary">
                      My Orders
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
