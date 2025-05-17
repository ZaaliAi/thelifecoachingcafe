
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
          console.error(`[AuthProvider] CRITICAL: Firebase user (UID: ${firebaseUser.uid}) has an invalid or missing email. Auth processing stopped. This user might need to be manually cleaned up in Firebase Auth.`);
          setUser(null);
          setLoading(false);
          localStorage.removeItem(SIGNUP_ROLE_KEY);
          return;
        }

        let determinedRole: UserRole = 'user'; 
        let userName = firebaseUser.displayName || firebaseUser.email!.split('@')[0] || 'User';
        
        let existingProfile: (FirestoreUserProfile & { id: string }) | null = null;
        let profileNeedsCreationDueToSignup = false;

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
          const signupRoleAttempt = localStorage.getItem(SIGNUP_ROLE_KEY) as UserRole | null;
          if (signupRoleAttempt) {
            determinedRole = signupRoleAttempt;
            console.log(`[AuthProvider] Role for new user ${firebaseUser.email} from localStorage: ${determinedRole}`);
            profileNeedsCreationDueToSignup = true; 
          } else {
            determinedRole = 'user'; 
            console.warn(`[AuthProvider] No localStorage role for new user ${firebaseUser.email} and no existing profile, defaulting to 'user'.`);
            profileNeedsCreationDueToSignup = true; 
          }
        }
        
        const appUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email, 
          role: determinedRole,
          name: userName,
          // profileImageUrl from firebaseUser.photoURL is intentionally NOT set here for the appUser context
          // if the main profile setup forms are the source of truth for profileImageUrl.
          // If Firebase Auth photoURL should be the default display, it could be:
          // profileImageUrl: firebaseUser.photoURL || undefined,
        };
        
        setUser(appUser);
        console.log("[AuthProvider] App user context set:", JSON.stringify(appUser, null, 2));

        if (profileNeedsCreationDueToSignup && !existingProfile) {
          console.log(`[AuthProvider] No existing profile for ${firebaseUser.uid}. Attempting to create initial profile in Firestore with role: ${determinedRole}.`);
          try {
            // Prepare data for initial Firestore document.
            // profileImageUrl is explicitly NOT included here as per user request for initial setup.
            const dataForFirestore: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt' | 'profileImageUrl'>> = {
              name: userName, 
              email: firebaseUser.email!, 
              role: determinedRole,
              // No profileImageUrl is sent from here
            };
            if (determinedRole === 'coach') {
              dataForFirestore.subscriptionTier = 'free';
            }
            // `createdAt` and `updatedAt` will be handled by `setUserProfile`
            
            console.log("[AuthProvider] About to call setUserProfile for NEW user with data (profileImageUrl intentionally omitted):", JSON.stringify(dataForFirestore, null, 2));
            await setUserProfile(firebaseUser.uid, dataForFirestore); 
            
            console.log(`[AuthProvider] Initial Firestore profile CREATED for ${firebaseUser.email} with role ${determinedRole}.`);
            localStorage.removeItem(SIGNUP_ROLE_KEY); 
          } catch (profileError) {
            console.error(`[AuthProvider] Error CREATING initial Firestore profile for ${firebaseUser.email}:`, profileError);
          }
        } else if (existingProfile && existingProfile.role !== determinedRole && determinedRole === 'admin') {
            console.log(`[AuthProvider] Admin user ${firebaseUser.email} has role ${existingProfile.role} in Firestore. Updating to 'admin'.`);
            try {
                const userDocRef = doc(db, "users", firebaseUser.uid);
                await updateDoc(userDocRef, { role: 'admin', updatedAt: serverTimestamp() });
                console.log(`[AuthProvider] Admin role updated in Firestore for ${firebaseUser.email}`);
            } catch (updateError) {
                console.error(`[AuthProvider] Error updating admin role in Firestore for ${firebaseUser.email}:`, updateError);
            }
        }

      } else {
        setUser(null);
        console.log("[AuthProvider] No Firebase user, app user context set to null.");
        localStorage.removeItem(SIGNUP_ROLE_KEY);
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
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      console.log(`[AuthProvider] Firebase Auth user CREATED: ${userCredential.user.uid} for email ${email}`);

      await updateProfile(userCredential.user, { displayName: name });
      console.log(`[AuthProvider] Firebase Auth profile updated with displayName: ${name}`);
      
      // onAuthStateChanged listener will handle creating the Firestore document.
      return role;
    } catch (error: any) {
      setLoading(false); 
      console.error("[AuthProvider] Firebase signup error:", error.code, error.message);
      localStorage.removeItem(SIGNUP_ROLE_KEY); 
      throw error; 
    }
  };

  const logoutUser = async () => {
    console.log("[AuthProvider] logoutUser attempting.");
    try {
      await signOut(auth);
      console.log("[AuthProvider] Firebase signOut successful. User context will be cleared by onAuthStateChanged.");
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
