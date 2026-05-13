import { create } from 'zustand';
import { api, ApiUser, ApiProfile, ApiShop } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useStore } from '@/store/useStore';

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

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  shop: Shop | null;
  loading: boolean;

  // Derived state
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isCustomer: boolean;
  isShopApproved: boolean;

  // Actions
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
  initAuth: () => Promise<void>;
}

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
    commission_rate: apiShop.commissionRate ?? null,
    created_at: '',
    updated_at: '',
  };
};

// Helper to derive role-based flags
const deriveRoleFlags = (role: AppRole | null, shop: Shop | null) => ({
  isAdmin: role === 'admin',
  isSuperAdmin: role === 'superadmin',
  isCustomer: role === 'customer',
  isShopApproved: shop?.status === 'approved',
});

export const useAuthStore = create<AuthState>()((set, get) => {
  // Fetch and hydrate the user's active vehicle into the app store
  const hydrateActiveVehicle = async () => {
    try {
      const vehicles = await api.getUserVehicles();
      const active = (vehicles || []).find((v) => v.isActive);
      if (active) {
        useStore.getState().setUserVehicle({
          id: active.id,
          brand: active.brand?.name ?? '',
          model: active.model?.name ?? '',
          year: active.year,
          registrationNumber: active.registrationNumber,
        });
      }
    } catch {
      // Silently fail — vehicles are not critical for auth
    }
  };

  const fetchUserData = async () => {
    try {
      const authUser = await api.getCurrentUser();

      if (!authUser) {
        set({ user: null, session: null, profile: null, role: null, shop: null, ...deriveRoleFlags(null, null) });
        return;
      }

      const user: User = {
        id: authUser.id,
        email: authUser.email,
      };

      const session: Session = {
        access_token: api.getToken() || '',
        user: { id: authUser.id, email: authUser.email },
      };

      const profile: Profile = mapApiProfile(authUser.profile) || {
        id: authUser.id,
        user_id: authUser.id,
        full_name: authUser.fullName || '',
        email: authUser.email || '',
        phone: authUser.phone || null,
        avatar_url: authUser.avatarUrl || null,
        address: authUser.address || null,
        city: authUser.city || null,
        postal_code: authUser.postalCode || null,
      };

      // Get the primary role (highest privilege)
      const roles = authUser.userRoles?.map((r) => r.role) || [];
      let role: AppRole;
      if (roles.includes('superadmin')) {
        role = 'superadmin';
      } else if (roles.includes('admin')) {
        role = 'admin';
      } else {
        role = 'customer';
      }

      const shop = mapApiShop(authUser.shop);

      set({ user, session, profile, role, shop, ...deriveRoleFlags(role, shop) });
    } catch {
      // User not authenticated or token expired
      set({ user: null, session: null, profile: null, role: null, shop: null, ...deriveRoleFlags(null, null) });
    }
  };

  return {
    // State
    user: null,
    session: null,
    profile: null,
    role: null,
    shop: null,
    loading: true,

    // Derived state (initial)
    isAdmin: false,
    isSuperAdmin: false,
    isCustomer: false,
    isShopApproved: false,

    // Actions
    initAuth: async () => {
      const token = api.getToken();
      if (token) {
        await fetchUserData();
        await hydrateActiveVehicle();
        // Load the user's cart from backend
        await useStore.getState().syncCartFromApi();
      }
      set({ loading: false });
    },

    signUp: async (email, password, metadata) => {
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
        return { error: error as Error };
      }
    },

    signUpSeller: async (data) => {
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
        return { error: error as Error };
      }
    },

    signIn: async (email, password) => {
      try {
        await api.login(email, password);
        await fetchUserData();
        await hydrateActiveVehicle();
        // Load this user's cart from backend
        await useStore.getState().syncCartFromApi();

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
        return { error: error as Error };
      }
    },

    signOut: async () => {
      try {
        await api.logout();
      } catch {
        // Logout anyway even if API call fails
      }

      set({
        user: null,
        session: null,
        profile: null,
        role: null,
        shop: null,
        ...deriveRoleFlags(null, null),
      });
      useStore.getState().setUserVehicle(null);
      useStore.getState().clearCart();

      toast({
        title: 'Signed Out',
        description: 'You have been signed out.',
      });
    },

    refreshProfile: async () => {
      if (get().user) {
        await fetchUserData();
      }
    },
  };
});
