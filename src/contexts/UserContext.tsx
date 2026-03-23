'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getAuthHeaders, getUserFromToken } from '@/lib/api';

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
  const [user, setUser] = useState<UserProfile | null>(null);
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
        setUser({
          name: tokenUser.name,
          email: tokenUser.email,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch if token exists
    const token = typeof window !== 'undefined' ? localStorage.getItem('notion_token') : null;
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
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
