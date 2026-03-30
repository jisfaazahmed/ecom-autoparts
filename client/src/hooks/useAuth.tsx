import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
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
    role: (apiUser?.role || apiUser?.userRoles?.[0]?.role || 'customer').toString().toLowerCase(),
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

      if (user) {
        setLoading(false);
        return;
      }

      try {
        const current = await api.getCurrentUser();
        if (current) {
          const mapped = mapUser(current);
          localStorage.setItem('user', JSON.stringify(mapped));
          localStorage.setItem('auth_token', token);
          setUser(mapped);
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
  }, [user]);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.login(email, password);
      setSession(response);
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
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
    return { error: new Error('Not implemented') };
  };

  const refreshProfile = async () => {};

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated: !!user,
      role: user?.role || null,
      shop: null,
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
