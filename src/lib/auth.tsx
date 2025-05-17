
"use client";

import type { User, UserRole, FirestoreUserProfile } from '@/types';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { auth, db } from './firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile, // Renamed to avoid conflict
  type User as FirebaseUser
} from 'firebase/auth';
import { setUserProfile, getUserProfile } from './firestore';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'; // Added updateDoc

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, role: UserRole) => Promise<UserRole | null>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Key for storing signup role temporarily if needed, though direct creation is preferred
const SIGNUP_ROLE_KEY = 'coachconnect-signup-role'; 

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[AuthProvider] Mounting onAuthStateChanged listener.");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log("[AuthProvider] onAuthStateChanged event. Firebase user:", firebaseUser ? firebaseUser.uid : 'null');
      if (firebaseUser) {
        const validEmail = firebaseUser.email;
        if (!validEmail || typeof validEmail !== 'string' || validEmail.trim() === '') {
          console.error("[AuthProvider] CRITICAL: Firebase user object (UID: " + firebaseUser.uid + ") has an invalid or missing email during onAuthStateChanged. Aborting profile processing.");
          setUser(null); // Ensure app user is null if auth state is problematic
          setLoading(false);
          return;
        }

        let profileNeedsCreationDueToSignup = false;
        let determinedRole: UserRole = 'user'; // Default
        let userName = firebaseUser.displayName || validEmail.split('@')[0] || 'User';

        // Check if this is a new signup that needs role determination
        const signupRoleAttempt = localStorage.getItem(SIGNUP_ROLE_KEY) as UserRole | null;
        if (signupRoleAttempt) {
          determinedRole = signupRoleAttempt;
          profileNeedsCreationDueToSignup = true; // Flag that this is part of signup flow
          // Name from signup should already be on firebaseUser.displayName via updateFirebaseProfile
          userName = firebaseUser.displayName || userName; // Prioritize displayName if available
          console.log(`[AuthProvider] Signup role detected from localStorage: ${determinedRole} for ${validEmail}`);
        } else if (validEmail === 'hello@thelifecoachingcafe.com') {
            determinedRole = 'admin'; // Override for admin email
            userName = 'Admin User';
        }


        try {
          const existingUserProfile = await getUserProfile(firebaseUser.uid);
          
          if (existingUserProfile) {
            console.log(`[AuthProvider] Existing Firestore profile found for ${validEmail}:`, existingUserProfile);
            const appUser: User = {
              id: firebaseUser.uid,
              email: existingUserProfile.email, // Use email from Firestore profile
              role: existingUserProfile.role,   // Use role from Firestore profile
              name: existingUserProfile.name || userName,
            };
            setUser(appUser);
            console.log("[AuthProvider] App user context SET from existing Firestore profile:", JSON.stringify(appUser, null, 2));
            if (signupRoleAttempt) localStorage.removeItem(SIGNUP_ROLE_KEY); // Clean up if found
          } else if (profileNeedsCreationDueToSignup) {
            // This branch is now primarily handled by the signupUser function directly calling setUserProfile.
            // However, this acts as a fallback if onAuthStateChanged triggers before signupUser's setUserProfile call completes
            // or if there was an issue.
            console.log(`[AuthProvider] No Firestore profile for new signup ${validEmail} (UID: ${firebaseUser.uid}). Will be created by signupUser or this fallback.`);
            // The actual setUserProfile call is now primarily in signupUser.
            // This block ensures that if somehow missed, basic user context is set.
            const appUser: User = {
              id: firebaseUser.uid,
              email: validEmail,
              role: determinedRole,
              name: userName,
            };
            setUser(appUser); // Set a temporary app user, actual Firestore write is in signupUser
            console.log("[AuthProvider] Temporary app user context set for new signup (Firestore doc creation pending from signupUser):", JSON.stringify(appUser, null, 2));
          } else {
             // User is authenticated with Firebase, but no Firestore profile exists and it's not a fresh signup (e.g. imported user)
            console.warn(`[AuthProvider] User ${validEmail} (UID: ${firebaseUser.uid}) is authenticated but has no Firestore profile and not a fresh signup. Creating a default 'user' profile.`);
             const defaultProfileData: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>> = {
              name: userName,
              email: validEmail,
              role: 'user', // Default to 'user' if no other info
              profileImageUrl: firebaseUser.photoURL || null,
              // No subscriptionTier for default 'user'
            };
            await setUserProfile(firebaseUser.uid, defaultProfileData);
            const appUser: User = { id: firebaseUser.uid, email: validEmail, role: 'user', name: userName };
            setUser(appUser);
            console.log("[AuthProvider] Default 'user' Firestore profile created and app user context set.");
          }
        } catch (profileError) {
          console.error("[AuthProvider] Error processing user profile in onAuthStateChanged:", profileError);
          setUser(null); // Clear user if profile processing fails
        }
      } else { // firebaseUser is null
        setUser(null);
        console.log("[AuthProvider] No Firebase user, app user context set to null.");
        localStorage.removeItem(SIGNUP_ROLE_KEY); // Clean up on logout
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
      console.log(`[AuthProvider] Firebase signInWithEmailAndPassword successful for ${email}. Waiting for onAuthStateChanged.`);
    } catch (error: any) {
      setLoading(false); // Ensure loading is false on error
      console.error("[AuthProvider] Firebase login error:", error.code, error.message);
      throw error; // Re-throw for the login page to handle
    }
    // setLoading(false) will be handled by onAuthStateChanged or error block
  };

  const signupUser = async (name: string, email: string, pass: string, role: UserRole): Promise<UserRole | null> => {
    setLoading(true);
    console.log(`[AuthProvider] signupUser: Attempting for ${email} as ${role} with name: ${name}`);
    try {
      localStorage.setItem(SIGNUP_ROLE_KEY, role); // Store role for onAuthStateChanged fallback (though less needed now)

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      console.log(`[AuthProvider] signupUser: Firebase Auth user CREATED: ${firebaseUser.uid} for email ${email}`);

      await updateFirebaseProfile(firebaseUser, { displayName: name });
      console.log(`[AuthProvider] signupUser: Firebase Auth profile updated with displayName: ${name}`);
      
      // Directly create Firestore profile here
      const initialProfileData: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>> = {
        name: name, // Use name from form
        email: firebaseUser.email!, // Should be valid after userCredential
        role: role,
        profileImageUrl: firebaseUser.photoURL || null, // Always include, defaulting to null
      };
      if (role === 'coach') {
        initialProfileData.subscriptionTier = 'free';
      }
      // 'createdAt' and 'updatedAt' will be handled by setUserProfile
      
      console.log("[AuthProvider] signupUser - About to call setUserProfile with (profileData):", JSON.stringify(initialProfileData, null, 2));
      await setUserProfile(firebaseUser.uid, initialProfileData);
      console.log(`[AuthProvider] signupUser: Initial Firestore profile CREATED/MERGED for ${email} with role ${role}.`);
      
      localStorage.removeItem(SIGNUP_ROLE_KEY); // Clean up immediately after successful profile creation
      
      // The onAuthStateChanged listener will pick up this new user and set the app context.
      // We return the role so the signup page can redirect appropriately.
      // setLoading(false); // onAuthStateChanged will handle this
      return role;
    } catch (error: any) {
      setLoading(false);
      console.error("[AuthProvider] Firebase signup error:", error.code, error.message);
      localStorage.removeItem(SIGNUP_ROLE_KEY);
      throw error; // Re-throw for the signup page to handle
    }
  };

  const logoutUser = async () => {
    console.log("[AuthProvider] logoutUser attempting.");
    setLoading(true);
    try {
      await signOut(auth);
      // onAuthStateChanged will set user to null and clear localStorage
      console.log("[AuthProvider] Firebase signOut successful.");
      // setUser(null) and setLoading(false) will be handled by onAuthStateChanged
    } catch (error: any) {
      console.error("[AuthProvider] Firebase logout error:", error);
      setLoading(false); // Ensure loading is false on error
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
