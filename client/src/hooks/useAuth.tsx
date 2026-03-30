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
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signUpSeller: (data: any) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Fallback context to prevent crashes if a component renders outside AuthProvider
const fallbackContext: AuthContextType = {
  user: null,
  isAuthenticated: false,
  role: null,
  shop: null,
  loading: false,
  profile: null,
  login: async () => { throw new Error('AuthProvider missing: login unavailable'); },
  logout: () => {},
  signIn: async () => ({ error: new Error('AuthProvider missing: signIn unavailable') }),
  signOut: async () => {},
  signUpSeller: async () => ({ error: new Error('AuthProvider missing: signUp unavailable') }),
  refreshProfile: async () => {},
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const token = localStorage.getItem('auth_token');
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

  useEffect(() => {
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.login(email, password);
      // Map ApiUser to User interface
      const loggedInUser: User = {
        id: response.user.id || (response.user as any)._id || '',
        email: response.user.email || '',
        name: (response.user as any).fullName || (response.user as any).name || 'User',
        role: (response.user as any).role || 'customer',
      };

      localStorage.setItem('auth_token', response.accessToken);
      localStorage.setItem('user', JSON.stringify(loggedInUser));
      setUser(loggedInUser);
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
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
  const context = useContext(AuthContext);
  if (context === undefined) {
    console.warn('useAuth called outside AuthProvider; using fallback context');
    return fallbackContext;
  }
  return context;
}
