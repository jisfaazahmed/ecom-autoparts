/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';

import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  fullName?: string;
  phone?: string;
  role: string;
  status?: string;
  shopName?: string;
  commissionRate?: number;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  role: string | null;
  shop: any | null;
  loading: boolean;
  profile: any | null;
  signUp: (data: { email: string; password: string; fullName: string; phone?: string }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signUpSeller: (data: any) => Promise<{ error: Error | null }>;
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
  logout: () => {},
  signIn: async () => ({ error: new Error('AuthProvider missing: signIn unavailable') }),
  signOut: async () => {},
  signUpSeller: async () => ({ error: new Error('AuthProvider missing: signUp unavailable') }),
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

  const mapUser = (apiUser: any): User => ({
    id: apiUser?.id || apiUser?._id || apiUser?.userId || '',
    email: apiUser?.email || '',
    name: apiUser?.fullName || apiUser?.name || 'User',
    fullName: apiUser?.fullName || apiUser?.name,
    phone: apiUser?.phone,
    role: (apiUser?.role || apiUser?.userRoles?.[0]?.role || 'customer').toString().toLowerCase(),
    status: apiUser?.status,
    shopName: apiUser?.shopName,
    commissionRate: apiUser?.commissionRate,
    createdAt: apiUser?.createdAt,
  });

  const setSession = (authResponse: any) => {
    if (!authResponse?.accessToken || !authResponse?.user) return;
    const mapped = mapUser(authResponse.user);
    localStorage.setItem('auth_token', authResponse.accessToken);
    localStorage.setItem('user', JSON.stringify(mapped));
    setUser(mapped);
  };

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('accessToken');
      if (!token) {
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
            || mapped.commissionRate !== user.commissionRate;

          if (shouldUpdate) {
            localStorage.setItem('user', JSON.stringify(mapped));
            localStorage.setItem('auth_token', token);
            setUser(mapped);
          }
        }
      } catch (e) {
        console.warn('Failed to hydrate user, clearing session');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.login(email, password);
      setSession(response);
    } catch (error) {
      throw error instanceof Error ? error : new Error('Login failed');
    }
  };

  const signUp = async (data: { email: string; password: string; fullName: string; phone?: string }) => {
    try {
      const response = await api.register({
        email: data.email,
        password: data.password,
        fullName: data.fullName,
        phone: data.phone,
      });
      setSession(response);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    setUser(null);
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
    logout();
  };

  const signUpSeller = async (data: any) => {
    try {
      const response = await api.registerSeller(data);
      setSession(response);
      return { error: null };
    } catch (error: any) {
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
    } catch (error) {
      console.warn('Failed to refresh profile', error);
    }
  };

  const shop = useMemo(() => buildShopFromUser(user), [user]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated: !!user,
      role: user?.role || null,
      shop,
      loading,
      profile: null,
      signUp,
      signIn,
      signOut,
      signUpSeller,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
