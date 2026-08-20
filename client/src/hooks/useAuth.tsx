/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';

import { api } from '../lib/api';
import { useStore } from '@/store/useStore';
import { toast } from '@/components/ui/use-toast';

interface User {
  id: string;
  email: string;
  name: string;
  fullName?: string;
  avatarUrl?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  role: string;
  status?: string;
  shopName?: string;
  commissionRate?: number;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  role: string | null;
  shop: any | null;
  loading: boolean;
  profile: any | null;
  signUp: (data: { email: string; password: string; fullName: string; phone?: string; address?: string }) => Promise<{ error: Error | null; verificationId?: string }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signUpSeller: (data: any) => Promise<{ error: Error | null; verificationId?: string }>;
  verifySignupOtp: (data: { verificationId: string; otp: string }) => Promise<{ error: Error | null }>;
  resendSignupOtp: (data: { verificationId: string }) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

// Default context prevents runtime crashes/warnings during fast refresh edge-cases.
const defaultAuthContext: AuthContextType = {
  user: null,
  isAuthenticated: false,
  role: null,
  shop: null,
  loading: false,
  profile: null,
  signUp: async () => ({ error: new Error('AuthProvider missing: signUp unavailable') }),
  login: async () => { throw new Error('AuthProvider missing: login unavailable'); },
  logout: async () => {},
  signIn: async () => ({ error: new Error('AuthProvider missing: signIn unavailable') }),
  signOut: async () => {},
  signUpSeller: async () => ({ error: new Error('AuthProvider missing: signUp unavailable') }),
  verifySignupOtp: async () => ({ error: new Error('AuthProvider missing: verifySignupOtp unavailable') }),
  resendSignupOtp: async () => ({ error: new Error('AuthProvider missing: resendSignupOtp unavailable') }),
  refreshProfile: async () => {},
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

const mapStatusToShopStatus = (status?: string) => {
  const normalized = String(status || '').toUpperCase();
  switch (normalized) {
    case 'ACTIVE':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'SUSPENDED':
      return 'suspended';
    case 'PENDING':
    default:
      return 'pending';
  }
};

const buildShopFromUser = (authUser: User | null) => {
  if (!authUser || authUser.role !== 'admin') return null;
  const status = mapStatusToShopStatus(authUser.status);
  const createdAt = authUser.createdAt;

  return {
    id: authUser.id,
    name: authUser.shopName || authUser.name || 'Shop',
    ownerId: authUser.id,
    status,
    email: authUser.email,
    commissionRate: authUser.commissionRate ?? 10,
    commission_rate: authUser.commissionRate ?? 10,
    createdAt,
    created_at: createdAt,
  };
};

// Build a profile object from the user so consumers like Navbar
// can access profile.full_name without needing a separate API call.
const buildProfileFromUser = (authUser: User | null) => {
  if (!authUser) return null;
  return {
    id: authUser.id,
    user_id: authUser.id,
    full_name: authUser.fullName || authUser.name || '',
    email: authUser.email,
    phone: authUser.phone || null,
    avatar_url: null,
    address: authUser.address || null,
    city: authUser.city || null,
    postal_code: authUser.postalCode || null,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('accessToken');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      try {
        return JSON.parse(storedUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any | null>(null);

  const mapUser = (apiUser: any): User => ({
    id: apiUser?.id || apiUser?._id || apiUser?.userId || '',
    email: apiUser?.email || '',
    name: apiUser?.fullName || apiUser?.name || 'User',
    fullName: apiUser?.fullName || apiUser?.name,
    avatarUrl: apiUser?.avatarUrl || apiUser?.avatar_url || null,
    phone: apiUser?.phone ?? apiUser?.profile?.phone,
    address: apiUser?.address ?? apiUser?.profile?.address,
    city: apiUser?.city ?? apiUser?.profile?.city,
    postalCode: apiUser?.postalCode ?? apiUser?.profile?.postalCode ?? apiUser?.profile?.postal_code,
    role: (apiUser?.role || apiUser?.userRoles?.[0]?.role || 'customer').toString().toLowerCase(),
    status: apiUser?.status,
    shopName: apiUser?.shopName,
    commissionRate: apiUser?.commissionRate,
    createdAt: apiUser?.createdAt,
  });

  const hydrateActiveVehicle = async (authUser: User | null) => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('accessToken');
    useStore.getState().setUserVehicle(null);

    if (!token || authUser?.role !== 'customer') return;

    try {
      const vehicles = await api.getUserVehicles();
      const currentToken = localStorage.getItem('auth_token') || localStorage.getItem('accessToken');
      if (currentToken !== token) return;

      const active = (vehicles || []).find((vehicle: any) => vehicle.isActive);
      if (active) {
        useStore.getState().setUserVehicle({
          id: active.id,
          brand: active.brand?.name ?? '',
          model: active.model?.name ?? '',
          year: active.year,
          registrationNumber: active.registrationNumber,
          brandId: active.brandId ?? active.brand?.id,
          modelId: active.modelId ?? active.model?.id,
        });
      }
    } catch {
      const currentToken = localStorage.getItem('auth_token') || localStorage.getItem('accessToken');
      if (currentToken === token) {
        useStore.getState().setUserVehicle(null);
      }
    }
  };

  const setSession = (authResponse: any): User | null => {
    if (!authResponse?.accessToken || !authResponse?.user) return null;
    const mapped = mapUser(authResponse.user);
    localStorage.setItem('auth_token', authResponse.accessToken);
    localStorage.setItem('user', JSON.stringify(mapped));
    setUser(mapped);
    return mapped;
  };

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('accessToken');
      if (!token) {
        useStore.getState().setUserVehicle(null);
        setLoading(false);
        return;
      }

      try {
        const current = await api.getCurrentUser();
        if (current) {
          const mapped = mapUser(current);
          const shouldUpdate = !user
            || mapped.id !== user.id
            || mapped.role !== user.role
            || mapped.status !== user.status
            || mapped.shopName !== user.shopName
            || mapped.commissionRate !== user.commissionRate
            || mapped.phone !== user.phone
            || mapped.address !== user.address
            || mapped.city !== user.city
            || mapped.postalCode !== user.postalCode;

          if (shouldUpdate) {
            localStorage.setItem('user', JSON.stringify(mapped));
            localStorage.setItem('auth_token', token);
            setUser(mapped);
          }
          await hydrateActiveVehicle(mapped);
          await useStore.getState().syncCartFromApi();
        } else {
          useStore.getState().setUserVehicle(null);
        }
        const currentProfile = await api.getMyProfile().catch(() => null);
        setProfile(currentProfile);
      } catch (e) {
        const message = e instanceof Error ? e.message : '';
        // Only clear session when the token is rejected — not on network/CORS failures.
        if (message.includes('Session expired') || message.includes('401')) {
          console.warn('Failed to hydrate user, clearing session');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          setUser(null);
          useStore.getState().setUserVehicle(null);
        } else {
          console.warn('Profile hydrate skipped (API unreachable):', message);
        }
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.login(email, password);
      const mapped = setSession(response);
      await hydrateActiveVehicle(mapped);
      await useStore.getState().syncCartFromApi();
      // Fetch full profile (phone, address, etc.) which the login response omits
      const currentProfile = await api.getMyProfile().catch(() => null);
      setProfile(currentProfile);
      toast({
        title: 'Welcome Back',
        description: 'You have successfully signed in',
      });
    } catch (error) {
      throw error instanceof Error ? error : new Error('Login failed');
    }
  };

  const signUp = async (data: { email: string; password: string; fullName: string; phone?: string; address?: string }) => {
    try {
      const response = await api.startRegister({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phone: data.phone,
        address: data.address,
      });
      return { error: null, verificationId: response?.verificationId };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account';
      toast({
        title: errorMessage,
        variant: 'destructive',
      });
      return { error };
    }
  };

  const logout = async () => {
    // Keep the server cart so items restore on next sign-in.
    // Only clear local state so the next browser session can't see this user's cart.
    useStore.getState().resetLocalCart();
    localStorage.removeItem('cart-storage');

    // Clear all known auth storage keys (this app has multiple legacy keys).
    localStorage.removeItem('auth_token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    api.logout();
    setUser(null);
    setProfile(null);

    toast({
      title: 'Signed Out',
      description: 'You have been signed out',
    });
  };

  const signIn = async (email: string, password: string) => {
    try {
      await login(email, password);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    await logout();
  };

  const signUpSeller = async (data: any) => {
    try {
      const response = await api.startRegisterSeller(data);
      return { error: null, verificationId: response?.verificationId };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create seller account';
      toast({
        title: 'Registration Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      return { error };
    }
  };

  const verifySignupOtp = async (data: { verificationId: string; otp: string }) => {
    try {
      const response = await api.verifyRegisterOtp(data);
      const mapped = setSession(response);
      await hydrateActiveVehicle(mapped);
      await useStore.getState().syncCartFromApi();
      toast({
        title: 'Account Verified',
        description: 'Your account has been created successfully.',
      });
      return { error: null };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'OTP verification failed';
      toast({
        title: 'Verification Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      return { error };
    }
  };

  const resendSignupOtp = async (data: { verificationId: string }) => {
    try {
      await api.resendRegisterOtp(data);
      toast({
        title: 'OTP Resent',
        description: 'A new verification code has been sent to your email.',
      });
      return { error: null };
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to resend OTP';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return { error };
    }
  };

  const refreshProfile = async () => {
    try {
      const current = await api.getCurrentUser();
      if (current) {
        const mapped = mapUser(current);
        localStorage.setItem('user', JSON.stringify(mapped));
        setUser(mapped);
      }
      const currentProfile = await api.getMyProfile().catch(() => null);
      setProfile(currentProfile);
    } catch (error) {
      console.warn('Failed to refresh profile', error);
    }
  };

  const shop = useMemo(() => buildShopFromUser(user), [user]);
  const fallbackProfile = useMemo(() => buildProfileFromUser(user), [user]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated: !!user,
      role: user?.role || null,
      shop,
      loading,
      profile: profile || fallbackProfile,
      signUp,
      signIn,
      signOut,
      signUpSeller,
      verifySignupOtp,
      resendSignupOtp,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
