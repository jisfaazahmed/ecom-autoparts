import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, ApiUser, ApiProfile, ApiShop } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

type AppRole = 'customer' | 'admin' | 'superadmin';

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
}

interface Shop {
  id: string;
  owner_id: string;
  name: string;
  status: string;
  description: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  business_registration: string | null;
  logo_url: string | null;
  commission_rate: number | null;
  created_at: string;
  updated_at: string;
}

// Compatibility type for existing components expecting Supabase User
interface User {
  id: string;
  email?: string;
}

// Compatibility type for session
interface Session {
  access_token: string;
  user: User;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  shop: Shop | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: { full_name?: string; phone?: string; role?: string }) => Promise<{ error: Error | null }>;
  signUpSeller: (data: {
    email: string;
    password: string;
    fullName: string;
    shopName: string;
    businessRegistration?: string;
    shopDescription?: string;
    phone?: string;
    address?: string;
  }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isCustomer: boolean;
  isShopApproved: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to convert API profile to local Profile format
const mapApiProfile = (apiProfile: ApiProfile | null | undefined): Profile | null => {
  if (!apiProfile) return null;
  return {
    id: apiProfile.id,
    user_id: apiProfile.userId,
    full_name: apiProfile.fullName,
    email: apiProfile.email,
    phone: apiProfile.phone || null,
    avatar_url: apiProfile.avatarUrl || null,
    address: apiProfile.address || null,
    city: apiProfile.city || null,
    postal_code: apiProfile.postalCode || null,
  };
};

// Helper to convert API shop to local Shop format
const mapApiShop = (apiShop: ApiShop | null | undefined): Shop | null => {
  if (!apiShop) return null;
  return {
    id: apiShop.id,
    owner_id: apiShop.ownerId,
    name: apiShop.name,
    status: apiShop.status,
    description: apiShop.description || null,
    email: apiShop.email || null,
    phone: apiShop.phone || null,
    address: apiShop.address || null,
    business_registration: apiShop.businessRegistration || null,
    logo_url: apiShop.logoUrl || null,
    commission_rate: apiShop.commissionRate,
    created_at: '',
    updated_at: '',
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUserData = async () => {
    try {
      const authUser = await api.getCurrentUser();
      
      if (!authUser) {
        setUser(null);
        setSession(null);
        setProfile(null);
        setRole(null);
        setShop(null);
        return;
      }
      
      setUser({
        id: authUser.id,
        email: authUser.email,
      });
      
      setSession({
        access_token: api.getToken() || '',
        user: { id: authUser.id, email: authUser.email },
      });
      
      setProfile(mapApiProfile(authUser.profile) || {
        id: authUser.id,
        user_id: authUser.id,
        full_name: authUser.fullName || '',
        email: authUser.email || '',
        phone: authUser.phone || null,
        avatar_url: authUser.avatarUrl || null,
        address: authUser.address || null,
        city: authUser.city || null,
        postal_code: authUser.postalCode || null,
      });
      
      // Get the primary role (highest privilege)
      const roles = authUser.userRoles?.map(r => r.role) || [];
      if (roles.includes('superadmin')) {
        setRole('superadmin');
      } else if (roles.includes('admin')) {
        setRole('admin');
      } else {
        setRole('customer');
      }
      
      setShop(mapApiShop(authUser.shop));
    } catch (error) {
      // User not authenticated or token expired
      setUser(null);
      setSession(null);
      setProfile(null);
      setRole(null);
      setShop(null);
    }
  };

  useEffect(() => {
    // Check for existing session on mount
    const initAuth = async () => {
      const token = api.getToken();
      if (token) {
        await fetchUserData();
      }
      setLoading(false);
    };
    
    initAuth();
  }, []);

  const signUp = async (
    email: string, 
    password: string, 
    metadata?: { full_name?: string; phone?: string; role?: string }
  ) => {
    try {
      await api.register({
        email,
        password,
        fullName: metadata?.full_name || email.split('@')[0],
        phone: metadata?.phone,
      });

      await fetchUserData();

      toast({
        title: 'Account Created',
        description: 'Your account has been created successfully.',
      });
      return { error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account';
      toast({
        title: 'Sign Up Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      return { error };
    }
  };

  const signUpSeller = async (data: {
    email: string;
    password: string;
    fullName: string;
    shopName: string;
    businessRegistration?: string;
    shopDescription?: string;
    phone?: string;
  }) => {
    try {
      await api.registerSeller({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        shopName: data.shopName,
        businessRegistration: data.businessRegistration,
        shopDescription: data.shopDescription,
        phone: data.phone,
        address: data.address,
      });

      await fetchUserData();

      toast({
        title: 'Seller Account Created',
        description: 'Your seller account has been created. Your shop is pending approval.',
      });
      return { error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create seller account';
      toast({
        title: 'Registration Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      await api.login(email, password);
      await fetchUserData();

      toast({
        title: 'Welcome Back',
        description: 'You have successfully signed in.',
      });
      return { error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid email or password';
      toast({
        title: 'Sign In Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await api.logout();
    } catch (error) {
      // Logout anyway even if API call fails
    }
    
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setShop(null);
    
    toast({
      title: 'Signed Out',
      description: 'You have been signed out.',
    });
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData();
    }
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    role,
    shop,
    loading,
    signUp,
    signUpSeller,
    signIn,
    signOut,
    refreshProfile,
    isAdmin: role === 'admin',
    isSuperAdmin: role === 'superadmin',
    isCustomer: role === 'customer',
    isShopApproved: shop?.status === 'approved',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
