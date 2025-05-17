
"use client";

import type { User, UserRole, FirestoreUserProfile } from '@/types';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { auth, db } from './firebase'; // db import needed for Firestore operations
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { setUserProfile, getUserProfile } from './firestore';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, role: UserRole) => Promise<UserRole | null>; // Returns role on success
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SIGNUP_ROLE_KEY = 'coachconnect-signup-role';
const PENDING_COACH_PROFILE_KEY = 'coachconnect-pending-coach-profile';


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    console.log("[AuthProvider] Mounting onAuthStateChanged listener.");
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log("[AuthProvider] onAuthStateChanged event. Firebase user:", firebaseUser ? firebaseUser.uid : 'null');
      if (firebaseUser) {
        if (!firebaseUser.email || typeof firebaseUser.email !== 'string' || firebaseUser.email.trim() === '') {
          console.error(`[AuthProvider] CRITICAL: Firebase user (UID: ${firebaseUser.uid}) has an invalid or missing email. Auth processing stopped.`);
          setUser(null);
          setLoading(false);
          localStorage.removeItem(SIGNUP_ROLE_KEY);
          localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
          return;
        }

        let determinedRole: UserRole = 'user';
        let userName = firebaseUser.displayName || firebaseUser.email!.split('@')[0] || 'User';
        let existingProfile: (FirestoreUserProfile & { id: string }) | null = null;
        
        try {
          existingProfile = await getUserProfile(firebaseUser.uid);
          console.log(`[AuthProvider] Fetched existing profile for ${firebaseUser.uid}:`, existingProfile ? `Role: ${existingProfile.role}, Name: ${existingProfile.name}` : 'No profile found');
        } catch (e) {
          console.error("[AuthProvider] Error fetching existing profile during auth state change:", e);
        }

        if (firebaseUser.email === 'hello@thelifecoachingcafe.com') {
          determinedRole = 'admin';
          userName = 'Admin User';
        } else if (existingProfile) {
          determinedRole = existingProfile.role;
          userName = existingProfile.name || userName;
        } else {
          // This block is mainly for users created directly in Firebase console
          // or if signupUser didn't complete Firestore profile creation (e.g., due to previous errors).
          const signupRoleAttempt = localStorage.getItem(SIGNUP_ROLE_KEY) as UserRole | null;
          if (signupRoleAttempt) {
            determinedRole = signupRoleAttempt;
          } else {
            determinedRole = 'user'; // Default if no role found
          }
          console.log(`[AuthProvider] onAuthStateChanged: No existing profile for ${firebaseUser.uid}. Determined role: ${determinedRole}. Attempting to create.`);
          try {
            const dataForFirestore: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>> = {
              name: userName,
              email: firebaseUser.email!,
              role: determinedRole,
              // profileImageUrl is intentionally NOT set here as it's removed from initial signup
              subscriptionTier: undefined, 
            };
            if (determinedRole === 'coach') {
              dataForFirestore.subscriptionTier = 'free';
            } else {
              delete dataForFirestore.subscriptionTier; 
            }
            console.log("[AuthProvider] onAuthStateChanged - About to call setUserProfile for NEW user with (profileData):", JSON.stringify(dataForFirestore, null, 2));
            await setUserProfile(firebaseUser.uid, dataForFirestore);
            console.log(`[AuthProvider] onAuthStateChanged: Initial Firestore profile CREATED for ${firebaseUser.email} with role ${determinedRole}.`);
            localStorage.removeItem(SIGNUP_ROLE_KEY);
            localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
          } catch (profileError) {
            console.error(`[AuthProvider] onAuthStateChanged: Error CREATING initial Firestore profile for ${firebaseUser.email}:`, profileError);
          }
        }

        const appUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          role: determinedRole,
          name: userName,
        };
        setUser(appUser);
        console.log("[AuthProvider] App user context set:", JSON.stringify(appUser, null, 2));

      } else {
        setUser(null);
        console.log("[AuthProvider] No Firebase user, app user context set to null.");
        localStorage.removeItem(SIGNUP_ROLE_KEY);
        localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
      }
      setLoading(false);
      console.log("[AuthProvider] Loading state set to false.");
    });

    return () => {
      console.log("[AuthProvider] Unmounting onAuthStateChanged listener.");
      unsubscribe();
    };
  }, []);

  const loginUser = async (email: string, pass: string) => {
    setLoading(true);
    console.log(`[AuthProvider] loginUser attempting for ${email}`);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      console.log(`[AuthProvider] signInWithEmailAndPassword successful for ${email}. Waiting for onAuthStateChanged.`);
    } catch (error: any) {
      setLoading(false);
      console.error("[AuthProvider] Firebase login error:", error.code, error.message);
      throw error;
    }
  };

  const signupUser = async (name: string, email: string, pass: string, role: UserRole): Promise<UserRole | null> => {
    setLoading(true);
    console.log(`[AuthProvider] signupUser attempting for ${email} as ${role} with name: ${name}`);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      console.log(`[AuthProvider] Firebase Auth user CREATED: ${firebaseUser.uid} for email ${email}`);

      await updateProfile(firebaseUser, { displayName: name });
      console.log(`[AuthProvider] Firebase Auth profile updated with displayName: ${name}`);
      
      const dataForFirestore: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>> = {
        name: name, 
        email: firebaseUser.email!,
        role: role,
        // profileImageUrl is intentionally NOT set here as it's removed from initial signup
        subscriptionTier: undefined,
      };

      if (role === 'coach') {
        dataForFirestore.subscriptionTier = 'free';
        try {
          localStorage.setItem(PENDING_COACH_PROFILE_KEY, JSON.stringify({ name, email }));
        } catch (e) { console.error("Error saving pending coach profile to localStorage", e); }
      } else {
        delete dataForFirestore.subscriptionTier; 
      }

      console.log("[AuthProvider] signupUser - About to call setUserProfile for NEW user with (profileData):", JSON.stringify(dataForFirestore, null, 2));
      await setUserProfile(firebaseUser.uid, dataForFirestore);
      console.log(`[AuthProvider] signupUser: Initial Firestore profile CREATED for ${email} with role ${role}.`);
      
      localStorage.removeItem(SIGNUP_ROLE_KEY); 

      return role;
    } catch (error: any) {
      setLoading(false);
      console.error("[AuthProvider] Firebase signup error:", error.code, error.message);
      localStorage.removeItem(SIGNUP_ROLE_KEY);
      localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
      throw error;
    }
  };

  const logoutUser = async () => {
    console.log("[AuthProvider] logoutUser attempting.");
    try {
      await signOut(auth);
      console.log("[AuthProvider] Firebase signOut successful.");
    } catch (error: any) {
      console.error("[AuthProvider] Firebase logout error:", error);
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

    