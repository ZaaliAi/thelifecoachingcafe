
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
  signup: (name: string, email: string, pass: string, role: UserRole) => Promise<UserRole | null>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SIGNUP_ROLE_KEY = 'coachconnect-signup-role';
const PENDING_COACH_PROFILE_KEY = 'coachconnect-pending-coach-profile';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // const router = useRouter(); // Not directly used in this version of AuthProvider

  useEffect(() => {
    console.log("[AuthProvider] Mounting onAuthStateChanged listener.");
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log("[AuthProvider] onAuthStateChanged event. Firebase user:", firebaseUser ? firebaseUser.uid : 'null');
      if (firebaseUser) {
        const validEmail = firebaseUser.email;
        if (!validEmail || typeof validEmail !== 'string' || validEmail.trim() === '') {
          console.error("[AuthProvider] CRITICAL: Firebase user object (UID: " + firebaseUser.uid + ") has an invalid or missing email. Aborting profile creation.");
          setUser(null);
          setLoading(false);
          try {
            localStorage.removeItem(SIGNUP_ROLE_KEY);
            localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
          } catch (e) { console.warn("Error clearing localStorage in critical email failure path", e); }
          return;
        }

        let determinedRole: UserRole = 'user'; // Default if no other info
        let userName = firebaseUser.displayName || validEmail.split('@')[0] || 'User';
        
        // Admin check based on email
        if (validEmail === 'hello@thelifecoachingcafe.com') {
          determinedRole = 'admin';
          userName = 'Admin User';
        }

        try {
          const userProfileSnap = await getDoc(doc(db, "users", firebaseUser.uid));

          if (!userProfileSnap.exists()) {
            console.log(`[AuthProvider] No Firestore profile for ${firebaseUser.uid}. Attempting to create based on Auth state and signup info.`);
            
            // Determine role and name for new user profile creation
            const signupRoleAttempt = localStorage.getItem(SIGNUP_ROLE_KEY) as UserRole | null;
            if (signupRoleAttempt) {
              determinedRole = signupRoleAttempt;
              if (determinedRole === 'coach') {
                const pendingProfileStr = localStorage.getItem(PENDING_COACH_PROFILE_KEY);
                if (pendingProfileStr) {
                  try {
                    const pendingProfile = JSON.parse(pendingProfileStr);
                    userName = pendingProfile.name || userName; 
                  } catch (e) {
                    console.warn("Could not parse pending coach profile name from localStorage", e);
                  }
                }
              }
            } else if (validEmail === 'hello@thelifecoachingcafe.com') { // Ensure admin role is set if it's the admin email
                determinedRole = 'admin';
                userName = 'Admin User';
            }
            // Else, 'determinedRole' remains 'user' if no other logic sets it

            const dataForFirestore: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>> = {
              name: userName,
              email: validEmail,
              role: determinedRole,
              profileImageUrl: firebaseUser.photoURL || null, // ALWAYS include this, defaulting to null
            };

            if (determinedRole === 'coach') {
              dataForFirestore.subscriptionTier = 'free';
            }
            // For 'user' or 'admin', subscriptionTier is intentionally omitted from dataForFirestore
            // to align with rules that expect the key to be absent.

            console.log("[AuthProvider] About to call setUserProfile for NEW user with (profileData):", JSON.stringify(dataForFirestore, null, 2));
            await setUserProfile(firebaseUser.uid, dataForFirestore); // setUserProfile adds createdAt/updatedAt
            console.log(`[AuthProvider] Initial Firestore profile CREATED for ${validEmail} with role ${determinedRole}.`);
            localStorage.removeItem(SIGNUP_ROLE_KEY);
            localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
          }

          // Fetch the latest profile to set the app user state
          const finalProfile = await getUserProfile(firebaseUser.uid);
          if (finalProfile) {
            const appUser: User = {
              id: firebaseUser.uid,
              email: finalProfile.email,
              role: finalProfile.role,
              name: finalProfile.name || userName,
              // profileImageUrl is part of FirestoreUserProfile, not directly on User context type for now
            };
            setUser(appUser);
            console.log("[AuthProvider] App user context SET/UPDATED from Firestore:", JSON.stringify(appUser, null, 2));
          } else {
            console.warn(`[AuthProvider] Profile not found for UID ${firebaseUser.uid} after creation/fetch attempt. Setting app user to null.`);
            setUser(null);
          }
        } catch (profileError) {
          console.error("[AuthProvider] Error processing user profile in onAuthStateChanged:", profileError);
          setUser(null);
        }
      } else {
        setUser(null);
        console.log("[AuthProvider] No Firebase user, app user context set to null.");
        try {
          localStorage.removeItem(SIGNUP_ROLE_KEY);
          localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
        } catch(e) { console.warn("Error clearing localStorage on logout/no user path", e); }
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
      // onAuthStateChanged will handle setting user state and profile loading
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
      localStorage.setItem(SIGNUP_ROLE_KEY, role);
      if (role === 'coach') {
          try {
            // Only store name for pre-filling register-coach page, email comes from auth user
            localStorage.setItem(PENDING_COACH_PROFILE_KEY, JSON.stringify({ name: name }));
          } catch (e) { console.error("Error saving pending coach profile name to localStorage", e); }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      console.log(`[AuthProvider] Firebase Auth user CREATED: ${firebaseUser.uid} for email ${email}`);

      await updateProfile(firebaseUser, { displayName: name });
      console.log(`[AuthProvider] Firebase Auth profile updated with displayName: ${name}`);
      
      // Initial profile creation will be handled by onAuthStateChanged.
      // It will use the stored SIGNUP_ROLE_KEY and PENDING_COACH_PROFILE_KEY.
      // setLoading(false) will be handled by onAuthStateChanged.
      return role; 
    } catch (error: any) {
      setLoading(false);
      console.error("[AuthProvider] Firebase signup error:", error.code, error.message);
      try {
        localStorage.removeItem(SIGNUP_ROLE_KEY);
        localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
      } catch (e) { console.warn("Error clearing localStorage after signup error", e); }
      throw error;
    }
  };

  const logoutUser = async () => {
    console.log("[AuthProvider] logoutUser attempting.");
    setLoading(true); // To avoid brief flash of logged-out content if redirects are slow
    try {
      await signOut(auth);
      // onAuthStateChanged will set user to null and clear localStorage
      console.log("[AuthProvider] Firebase signOut successful.");
    } catch (error: any) {
      console.error("[AuthProvider] Firebase logout error:", error);
      // setLoading(false); // onAuthStateChanged will eventually set it
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
