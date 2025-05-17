
"use client";

import type { User, UserRole } from '@/types';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface AuthContextType {
  user: User | null;
  login: (email: string, role: UserRole) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading user from storage
    setLoading(true); // Explicitly set loading to true at the start
    try {
      const storedUser = localStorage.getItem('coachconnect-user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error("Failed to parse stored user from localStorage:", error);
      // Optionally clear the corrupted item
      try {
        localStorage.removeItem('coachconnect-user');
      } catch (removeError) {
        console.error("Failed to remove corrupted user item from localStorage:", removeError);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (email: string, role: UserRole) => {
    // In a real app, this would involve API calls and token handling
    const mockUser: User = {
      id: Date.now().toString(), // simple unique id
      email,
      role,
      name: email.split('@')[0] // simple name generation
    };
    if (email === 'hello@thelifecoachingcafe.com') { // Provided admin credentials
        mockUser.role = 'admin';
        mockUser.name = 'Admin User';
    }
    setUser(mockUser);
    try {
      localStorage.setItem('coachconnect-user', JSON.stringify(mockUser));
    } catch (error) {
      console.error("Failed to save user to localStorage:", error);
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem('coachconnect-user');
    } catch (error) {
      console.error("Failed to remove user from localStorage:", error);
    }
  };

  const providerValue = { user, login, logout, loading };

  return (
    <AuthContext.Provider value={providerValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
