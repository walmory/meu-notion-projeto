'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getAuthHeaders, getAuthToken, getUserFromToken } from '@/lib/api';

export interface UserProfile {
  name: string;
  email?: string;
  bio?: string;
  avatar_url?: string;
}

interface UserContextData {
  user: UserProfile | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

const UserContext = createContext<UserContextData>({
  user: null,
  loading: true,
  refreshUser: async () => {},
  setUser: () => {},
});

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    // Apenas fallback do token pra não piscar vazio.
    // REMOVIDO: localStorage.getItem('user_profile_cache') para evitar ghosting entre contas.
    if (typeof window !== 'undefined') {
      try {
        const tokenUser = getUserFromToken();
        if (tokenUser) {
          return { name: tokenUser.name, email: tokenUser.email };
        }
      } catch (e) {
        // ignore parse error
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const response = await axios.get('https://apinotion.andrekehrer.com/user/profile', {
        headers: getAuthHeaders(),
      });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user profile, falling back to token:', error);
      const tokenUser = getUserFromToken();
      if (tokenUser) {
        const fallbackUser = { name: tokenUser.name, email: tokenUser.email };
        setUser(fallbackUser);
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleAuthChange = () => {
      const token = getAuthToken();
      if (token) {
        setLoading(true);
        // Tenta pegar imediatamente do token para UI instantânea
        const tokenUser = getUserFromToken();
        if (tokenUser) {
          setUser({ name: tokenUser.name, email: tokenUser.email });
        }
        fetchUser();
      } else {
        setUser(null);
        setLoading(false);
      }
    };

    // Only fetch if token exists on mount
    handleAuthChange();

    window.addEventListener('auth-changed', handleAuthChange);
    return () => window.removeEventListener('auth-changed', handleAuthChange);
  }, [fetchUser]);

  const refreshUser = async () => {
    await fetchUser();
  };

  return (
    <UserContext.Provider value={{ user, loading, refreshUser, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
