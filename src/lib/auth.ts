
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
    const storedUser = localStorage.getItem('coachconnect-user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
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
    localStorage.setItem('coachconnect-user', JSON.stringify(mockUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('coachconnect-user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
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
