
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

// Keys for localStorage to manage signup flow state
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

        let determinedRole: UserRole = 'user'; 
        let userName = firebaseUser.displayName || validEmail.split('@')[0] || 'User';
        let existingProfile: (FirestoreUserProfile & { id: string }) | null = null;
        let profileNeedsCreationDueToSignup = false;
        
        try {
          existingProfile = await getUserProfile(firebaseUser.uid);
          console.log(`[AuthProvider] Fetched existing profile for ${firebaseUser.uid}:`, existingProfile ? `Role: ${existingProfile.role}, Name: ${existingProfile.name}` : 'No profile found');
        } catch (e) {
          console.error("[AuthProvider] Error fetching existing profile during auth state change:", e);
        }

        if (validEmail === 'hello@thelifecoachingcafe.com') {
          determinedRole = 'admin';
          userName = 'Admin User';
        } else if (existingProfile) {
          determinedRole = existingProfile.role;
          userName = existingProfile.name || userName;
        } else {
          const signupRoleAttempt = localStorage.getItem(SIGNUP_ROLE_KEY) as UserRole | null;
          if (signupRoleAttempt) {
            determinedRole = signupRoleAttempt;
            if (determinedRole === 'coach') {
                try {
                    const pendingProfileStr = localStorage.getItem(PENDING_COACH_PROFILE_KEY);
                    if (pendingProfileStr) {
                        const pendingProfile = JSON.parse(pendingProfileStr);
                        userName = pendingProfile.name || userName;
                    }
                } catch(e) { console.warn("Could not parse pending coach profile name from localStorage"); }
            }
          } else {
            determinedRole = 'user'; 
          }
          profileNeedsCreationDueToSignup = true;
          console.log(`[AuthProvider] onAuthStateChanged: No existing profile for ${firebaseUser.uid}. Determined role: ${determinedRole}. Will attempt to create.`);
        }

        if (profileNeedsCreationDueToSignup) {
          // Ensure all fields expected by the Firestore rule's hasOnly clause are present
          const dataForFirestore: Partial<FirestoreUserProfile> = {
            name: userName,
            email: validEmail, 
            role: determinedRole,
            profileImageUrl: firebaseUser.photoURL || null, // ALWAYS include profileImageUrl, defaulting to null
            subscriptionTier: undefined, 
          };

          if (determinedRole === 'coach') {
            dataForFirestore.subscriptionTier = 'free';
          } else {
            // For 'user' or 'admin', if your rule's hasOnly for these roles does NOT include subscriptionTier, 
            // then delete it. If it DOES include it (expecting it to be null), then set it to null.
            // Based on your last rule, user/admin hasOnly does NOT include subscriptionTier.
            delete dataForFirestore.subscriptionTier; 
          }
          
          console.log("[AuthProvider] About to call setUserProfile for NEW user with (profileData):", JSON.stringify(dataForFirestore, null, 2));
          try {
            await setUserProfile(firebaseUser.uid, dataForFirestore);
            console.log(`[AuthProvider] onAuthStateChanged: Initial Firestore profile CREATED for ${validEmail} with role ${determinedRole}.`);
            localStorage.removeItem(SIGNUP_ROLE_KEY); 
            localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
          } catch (profileError) {
            console.error(`[AuthProvider] onAuthStateChanged: Error CREATING initial Firestore profile for ${validEmail}:`, profileError);
          }
        }
        
        const finalProfileToSet = await getUserProfile(firebaseUser.uid);
        if (finalProfileToSet) {
            const appUser: User = {
              id: firebaseUser.uid,
              email: finalProfileToSet.email,
              role: finalProfileToSet.role,
              name: finalProfileToSet.name || userName,
            };
            setUser(appUser);
            console.log("[AuthProvider] App user context SET/UPDATED:", JSON.stringify(appUser, null, 2));
        } else {
            console.warn(`[AuthProvider] Profile not found for UID ${firebaseUser.uid} after creation/fetch attempt. Setting app user to null.`);
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
      localStorage.setItem(SIGNUP_ROLE_KEY, role);
      if (role === 'coach') {
          try {
            localStorage.setItem(PENDING_COACH_PROFILE_KEY, JSON.stringify({ name, email }));
          } catch (e) { console.error("Error saving pending coach profile to localStorage", e); }
      }
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      console.log(`[AuthProvider] Firebase Auth user CREATED: ${firebaseUser.uid} for email ${email}`);

      await updateProfile(firebaseUser, { displayName: name });
      console.log(`[AuthProvider] Firebase Auth profile updated with displayName: ${name}`);
      
      console.log(`[AuthProvider] signupUser successful for ${email}. onAuthStateChanged will handle profile creation in Firestore.`);
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

    