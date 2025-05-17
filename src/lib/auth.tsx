
"use client";

import type { User, UserRole, FirestoreUserProfile } from '@/types';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { auth, db } from './firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  type User as FirebaseUser
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { setUserProfile, getUserProfile } from './firestore';


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
  const router = useRouter();

  useEffect(() => {
    console.log("AuthProvider: useEffect for onAuthStateChanged mounting.");
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log("AuthProvider: onAuthStateChanged triggered. Firebase user:", firebaseUser?.email);
      if (firebaseUser) {
        let determinedRole: UserRole = 'user';
        let userName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
        let profileNeedsCreationDueToSignup = false;
        // A common way to check if this is a new user from a recent signup vs. an existing user logging in
        const isNewFirebaseUser = firebaseUser.metadata.creationTime === firebaseUser.metadata.lastSignInTime;

        console.log(`AuthProvider: User ${firebaseUser.email}, isNewFirebaseUser: ${isNewFirebaseUser}, creationTime: ${firebaseUser.metadata.creationTime}, lastSignInTime: ${firebaseUser.metadata.lastSignInTime}`);

        if (firebaseUser.email === 'hello@thelifecoachingcafe.com') {
          determinedRole = 'admin';
          userName = 'Admin User';
          console.log(`AuthProvider: Admin user identified: ${userName}`);
        } else {
          const signupRoleAttempt = localStorage.getItem(SIGNUP_ROLE_KEY) as UserRole | null;
          if (signupRoleAttempt && isNewFirebaseUser) { // Only apply signup role if it's a truly new user session
            determinedRole = signupRoleAttempt;
            profileNeedsCreationDueToSignup = true;
            console.log(`AuthProvider: Role from signup localStorage: ${determinedRole}`);
          } else {
            const existingProfile = await getUserProfile(firebaseUser.uid);
            if (existingProfile) {
              determinedRole = existingProfile.role;
              userName = existingProfile.name || userName;
              console.log(`AuthProvider: Role from existing Firestore profile: ${determinedRole}`);
            } else {
              profileNeedsCreationDueToSignup = true;
              determinedRole = 'user'; // Sensible default if no signup role and no profile
              console.log(`AuthProvider: No Firestore profile, will create as '${determinedRole}'.`);
            }
          }
        }

        const appUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          role: determinedRole,
          name: userName,
          profileImageUrl: firebaseUser.photoURL || undefined,
        };
        setUser(appUser);
        console.log("AuthProvider: App user context set:", JSON.stringify(appUser, null, 2));

        // Ensure profile exists in Firestore & role is correct
        if (profileNeedsCreationDueToSignup) {
          console.log(`AuthProvider: Triggering profile creation for ${firebaseUser.email} with role ${determinedRole}.`);
          try {
            const dataForFirestore: Partial<FirestoreUserProfile> = {
              name: userName,
              email: firebaseUser.email!,
              role: determinedRole,
              profileImageUrl: firebaseUser.photoURL || null, // Explicitly null if undefined
              subscriptionTier: undefined, // Default to undefined, set specifically below
            };

            if (determinedRole === 'coach') {
              dataForFirestore.subscriptionTier = 'free';
            } else {
              // To satisfy the hasOnly clause that expects 'subscriptionTier' key if provided by user
              // but ensure it's not set for non-coaches if code doesn't delete it.
              // If rules strictly check hasOnly including subscriptionTier for all, send null.
              // If rules have role-dependent hasOnly (preferred), then delete for user/admin.
              // Based on YOUR provided rule's hasOnly clause, we MUST send subscriptionTier (as null for user/admin)
              dataForFirestore.subscriptionTier = null;
            }

            // `createdAt` and `updatedAt` will be added by `setUserProfile`
            await setUserProfile(firebaseUser.uid, dataForFirestore);
            console.log(`AuthProvider: User profile CREATED in Firestore for ${firebaseUser.email} with role ${determinedRole}`);
            if (localStorage.getItem(SIGNUP_ROLE_KEY)) {
              localStorage.removeItem(SIGNUP_ROLE_KEY);
              console.log("AuthProvider: Removed SIGNUP_ROLE_KEY from localStorage.");
            }
          } catch (profileError) {
            console.error("AuthProvider: Error CREATING user profile/role in Firestore:", profileError);
          }
        } else {
            // Existing user, verify role in Firestore is what we determined it should be (esp. for admin)
            const userProfileRef = doc(db, "users", firebaseUser.uid);
            const userProfileSnap = await getDoc(userProfileRef);
            if (userProfileSnap.exists() && userProfileSnap.data().role !== determinedRole) {
                console.log(`AuthProvider: Role mismatch for ${firebaseUser.email}. Auth determined: ${determinedRole}, Firestore had: ${userProfileSnap.data().role}. Updating Firestore.`);
                try {
                    await updateDoc(userProfileRef, { role: determinedRole, name: userName, updatedAt: serverTimestamp() });
                    console.log(`AuthProvider: User role/name UPDATED in Firestore for ${firebaseUser.email} to ${determinedRole}.`);
                } catch (updateError) {
                    console.error("AuthProvider: Error UPDATING user profile/role in Firestore:", updateError);
                }
            } else if (userProfileSnap.exists()) {
                console.log(`AuthProvider: Firestore profile for ${firebaseUser.email} exists with correct role ${determinedRole}.`);
            } else {
                // This case should ideally be covered by profileNeedsCreationDueToSignup=true,
                // but as a fallback, attempt creation if somehow missed.
                console.warn(`AuthProvider: Firestore profile for existing auth user ${firebaseUser.email} not found. Attempting creation.`);
                 try {
                    const dataForFirestore: Partial<FirestoreUserProfile> = {
                        name: userName,
                        email: firebaseUser.email!,
                        role: determinedRole,
                        profileImageUrl: firebaseUser.photoURL || null,
                        subscriptionTier: determinedRole === 'coach' ? 'free' : null,
                    };
                    await setUserProfile(firebaseUser.uid, dataForFirestore);
                 } catch (fallbackCreateError) {
                    console.error("AuthProvider: Error in fallback profile creation:", fallbackCreateError);
                 }
            }
        }

      } else {
        setUser(null);
        console.log("AuthProvider: No Firebase user, app user set to null.");
      }
      setLoading(false);
      console.log("AuthProvider: Loading state set to false.");
    });

    return () => {
      console.log("AuthProvider: useEffect for onAuthStateChanged unmounting.");
      unsubscribe();
    }
  }, []); // Empty dependency array: runs once on mount, cleans up on unmount

  const loginUser = async (email: string, pass: string) => {
    setLoading(true);
    console.log(`loginUser: Attempting to log in ${email}`);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle setting the user state and Firestore profile.
      // setLoading(false) will be handled by onAuthStateChanged or catch block
      console.log(`loginUser: signInWithEmailAndPassword successful for ${email}. Waiting for onAuthStateChanged.`);
    } catch (error: any) {
      setLoading(false);
      console.error("Firebase login error:", error.code, error.message);
      throw error;
    }
  };

  const signupUser = async (name: string, email: string, pass: string, role: UserRole): Promise<UserRole | null> => {
    setLoading(true);
    console.log(`signupUser: Attempting to sign up ${email} as ${role}`);
    try {
      localStorage.setItem(SIGNUP_ROLE_KEY, role); // Set role *before* creating user
      console.log(`signupUser: Set SIGNUP_ROLE_KEY to ${role}`);

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      console.log(`signupUser: Firebase Auth user CREATED: ${userCredential.user.uid} for email ${email}`);
      await updateProfile(userCredential.user, { displayName: name });
      console.log(`signupUser: Firebase Auth profile updated with displayName: ${name}`);

      if (role === 'coach') {
        localStorage.setItem(PENDING_COACH_PROFILE_KEY, JSON.stringify({ name, email }));
        console.log(`signupUser: Set PENDING_COACH_PROFILE_KEY for coach ${email}`);
      }
      // onAuthStateChanged will handle Firestore profile creation & clearing SIGNUP_ROLE_KEY.
      // setLoading(false) will be handled by onAuthStateChanged.
      return role;
    } catch (error: any) {
      setLoading(false);
      console.error("Firebase signup error:", error.code, error.message);
      localStorage.removeItem(SIGNUP_ROLE_KEY); // Clean up on error
      localStorage.removeItem(PENDING_COACH_PROFILE_KEY); // Clean up on error
      throw error;
    }
  };

  const logoutUser = async () => {
    setLoading(true);
    console.log("logoutUser: Attempting to sign out.");
    try {
      await signOut(auth);
      // setUser(null) and setLoading(false) will be handled by onAuthStateChanged
      localStorage.removeItem(SIGNUP_ROLE_KEY);
      localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
      console.log("logoutUser: Firebase signOut successful. Cleared localStorage keys.");
    } catch (error: any) {
      setLoading(false); // Ensure loading is false on error
      console.error("Firebase logout error:", error);
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
