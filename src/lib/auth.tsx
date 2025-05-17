
"use client";

import type { User, UserRole, FirestoreUserProfile } from '@/types';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { auth, db } from './firebase'; // db is needed for Firestore operations
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser
} from 'firebase/auth';
// useRouter is client-side only, which is fine here.
import { useRouter } from 'next/navigation';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { setUserProfile, getUserProfile } from './firestore';


interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, role: UserRole) => Promise<UserRole | null>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Keys for localStorage to assist role determination during signup and initial profile setup
const SIGNUP_ROLE_KEY = 'coachconnect-signup-role';
const PENDING_COACH_PROFILE_KEY = 'coachconnect-pending-coach-profile';


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter(); // Can be used for redirects if needed, though often handled by pages

  useEffect(() => {
    console.log("AuthProvider: Mounting onAuthStateChanged listener.");
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log("AuthProvider: onAuthStateChanged event. Firebase user:", firebaseUser ? firebaseUser.email : 'null');
      if (firebaseUser) {
        // CRITICAL CHECK FOR EMAIL
        if (!firebaseUser.email) {
          console.error("CRITICAL: Firebase user object is missing email after auth state change. This should not happen for email/password auth. User will not be processed further.");
          setUser(null); // Ensure no partial user state
          setLoading(false);
          // Clear any potentially misleading signup keys
          localStorage.removeItem(SIGNUP_ROLE_KEY);
          localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
          return; // Stop further processing for this invalid state
        }

        let determinedRole: UserRole = 'user'; // Default
        let userName = firebaseUser.displayName || firebaseUser.email.split('@')[0] || 'User';
        let profileNeedsCreationDueToSignup = false;

        const isNewFirebaseUser = firebaseUser.metadata.creationTime === firebaseUser.metadata.lastSignInTime;
        console.log(`AuthProvider: User ${firebaseUser.email}, isNewFirebaseUser: ${isNewFirebaseUser}`);

        if (firebaseUser.email === 'hello@thelifecoachingcafe.com') {
          determinedRole = 'admin';
          userName = 'Admin User';
        } else {
          const signupRoleAttempt = localStorage.getItem(SIGNUP_ROLE_KEY) as UserRole | null;
          if (signupRoleAttempt && isNewFirebaseUser) {
            determinedRole = signupRoleAttempt;
            profileNeedsCreationDueToSignup = true;
            console.log(`AuthProvider: Role for new user from localStorage: ${determinedRole}`);
          } else {
            const existingProfile = await getUserProfile(firebaseUser.uid);
            if (existingProfile) {
              determinedRole = existingProfile.role;
              userName = existingProfile.name || userName; 
              console.log(`AuthProvider: Role for existing user from Firestore: ${determinedRole}`);
            } else {
              profileNeedsCreationDueToSignup = true;
              determinedRole = 'user'; 
              console.log(`AuthProvider: No Firestore profile for existing auth user or non-signup scenario, will create as '${determinedRole}'.`);
            }
          }
        }

        const appUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email, // Now guaranteed to be a string due to check above
          role: determinedRole,
          name: userName,
          profileImageUrl: firebaseUser.photoURL || undefined,
        };
        setUser(appUser);
        console.log("AuthProvider: App user context set:", JSON.stringify(appUser, null, 2));

        if (profileNeedsCreationDueToSignup) {
          console.log(`AuthProvider: Triggering profile creation/update in Firestore for ${firebaseUser.email} with role ${determinedRole}.`);
          try {
            const dataForFirestore: Partial<Omit<FirestoreUserProfile, 'id'|'createdAt'|'updatedAt'>> = {
              name: userName,
              email: firebaseUser.email, // Guaranteed string by check above
              role: determinedRole,
              profileImageUrl: firebaseUser.photoURL || null, // Explicitly null if no photoURL
              subscriptionTier: undefined, 
            };

            if (determinedRole === 'coach') {
              dataForFirestore.subscriptionTier = 'free';
            } else {
              delete dataForFirestore.subscriptionTier; // Ensure it's not sent for non-coaches if rules are strict
            }
            
            await setUserProfile(firebaseUser.uid, dataForFirestore);
            console.log(`AuthProvider: User profile CREATED/MERGED in Firestore for ${firebaseUser.email} with role ${determinedRole}`);
            if (localStorage.getItem(SIGNUP_ROLE_KEY)) { 
              localStorage.removeItem(SIGNUP_ROLE_KEY);
              console.log("AuthProvider: Removed SIGNUP_ROLE_KEY from localStorage after profile creation.");
            }
          } catch (profileError) {
            console.error("AuthProvider: Error CREATING/MERGING user profile in Firestore:", profileError);
          }
        } else {
          const firestoreProfile = await getUserProfile(firebaseUser.uid);
          if (firestoreProfile && firestoreProfile.role !== determinedRole) {
            console.warn(`AuthProvider: Role mismatch for ${firebaseUser.email}. Auth-determined: ${determinedRole}, Firestore: ${firestoreProfile.role}. Consider updating context or Firestore role if needed.`);
          }
        }

      } else {
        setUser(null);
        console.log("AuthProvider: No Firebase user, app user context set to null.");
        localStorage.removeItem(SIGNUP_ROLE_KEY);
        localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
      }
      setLoading(false);
      console.log("AuthProvider: Loading state set to false.");
    });

    return () => {
      console.log("AuthProvider: Unmounting onAuthStateChanged listener.");
      unsubscribe();
    };
  }, []);

  const loginUser = async (email: string, pass: string) => {
    setLoading(true);
    console.log(`AuthProvider: loginUser attempting for ${email}`);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      console.log(`AuthProvider: signInWithEmailAndPassword successful for ${email}. Waiting for onAuthStateChanged.`);
    } catch (error: any) {
      setLoading(false);
      console.error("AuthProvider: Firebase login error:", error.code, error.message);
      throw error; 
    }
  };

  const signupUser = async (name: string, email: string, pass: string, role: UserRole): Promise<UserRole | null> => {
    setLoading(true);
    console.log(`AuthProvider: signupUser attempting for ${email} as ${role}`);
    try {
      localStorage.setItem(SIGNUP_ROLE_KEY, role);
      console.log(`AuthProvider: Set SIGNUP_ROLE_KEY to ${role}`);

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      console.log(`AuthProvider: Firebase Auth user CREATED: ${userCredential.user.uid} for email ${email}`);

      await updateProfile(userCredential.user, { displayName: name });
      console.log(`AuthProvider: Firebase Auth profile updated with displayName: ${name}`);
      
      if (role === 'coach') {
        localStorage.setItem(PENDING_COACH_PROFILE_KEY, JSON.stringify({ name, email }));
        console.log(`AuthProvider: Set PENDING_COACH_PROFILE_KEY for coach ${email}`);
      }
      // onAuthStateChanged will handle Firestore profile creation. setLoading(false) happens in onAuthStateChanged.
      return role; 
    } catch (error: any) {
      setLoading(false);
      console.error("AuthProvider: Firebase signup error:", error.code, error.message);
      localStorage.removeItem(SIGNUP_ROLE_KEY);
      localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
      throw error; 
    }
  };

  const logoutUser = async () => {
    setLoading(true);
    console.log("AuthProvider: logoutUser attempting.");
    try {
      await signOut(auth);
      console.log("AuthProvider: Firebase signOut successful. onAuthStateChanged will clear user context and localStorage keys.");
    } catch (error: any) {
      setLoading(false);
      console.error("AuthProvider: Firebase logout error:", error);
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

    