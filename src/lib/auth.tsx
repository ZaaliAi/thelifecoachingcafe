
"use client";

import type { User, UserRole } from '@/types';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { auth } from './firebase'; // Import Firebase auth instance
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile,
  type User as FirebaseUser 
} from 'firebase/auth';
import { useRouter } from 'next/navigation'; // For redirecting after signup/login

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper keys for localStorage
const SIGNUP_ROLE_KEY = 'coachconnect-signup-role';
const PENDING_COACH_PROFILE_KEY = 'coachconnect-pending-coach-profile';


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        let role: UserRole = 'user'; // Default role
        let name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';

        // Check for admin
        if (firebaseUser.email === 'hello@thelifecoachingcafe.com') {
          role = 'admin';
          name = 'Admin User';
        } else {
          // Check if a role was set during signup
          try {
            const signupRole = localStorage.getItem(SIGNUP_ROLE_KEY) as UserRole | null;
            if (signupRole) {
              role = signupRole;
              // Potentially fetch full profile from Firestore here if it exists
              // For now, we just use the role stored at signup.
              // Clear it after use so it doesn't affect subsequent logins
              localStorage.removeItem(SIGNUP_ROLE_KEY);
            } else {
              // TODO: In a real app, fetch user profile from Firestore to get role
              // For now, this basic logic will do for navigating the dashboard.
            }
          } catch (e) {
            console.error("Error reading signup role from localStorage", e);
          }
        }
        
        const appUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          role: role,
          name: name,
          profileImageUrl: firebaseUser.photoURL || undefined,
        };
        setUser(appUser);

      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginUser = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle setting the user and redirecting
      // Role determination will happen in onAuthStateChanged
    } catch (error: any) {
      setLoading(false);
      console.error("Firebase login error:", error);
      throw error; // Re-throw to be caught by the form
    }
  };

  const signupUser = async (name: string, email: string, pass: string, role: UserRole) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCredential.user, { displayName: name });

      // Store the intended role and basic profile info if coach
      // This will be picked up by onAuthStateChanged or the register-coach page
      try {
        localStorage.setItem(SIGNUP_ROLE_KEY, role);
        if (role === 'coach') {
          localStorage.setItem(PENDING_COACH_PROFILE_KEY, JSON.stringify({ name, email }));
        }
      } catch (e) {
         console.error("Error saving signup info to localStorage", e);
      }
      // onAuthStateChanged will handle setting the user.
      // The actual redirection will be handled by the page after successful context update.
    } catch (error: any) {
      setLoading(false);
      console.error("Firebase signup error:", error);
      throw error; // Re-throw to be caught by the form
    }
  };

  const logoutUser = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      // onAuthStateChanged will set user to null
      router.push('/'); // Redirect to home after logout
    } catch (error: any) {
      console.error("Firebase logout error:", error);
      // Still set loading to false even if logout fails for some reason
      setLoading(false);
      throw error;
    }
  };
  
  const providerValue = { user, login: loginUser, signup: signupUser, logout: logoutUser, loading };

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
