
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
import { setUserProfile, getUserProfile } from './firestore';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'; // Added getDoc and updateDoc

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
  // useRouter removed as it's not directly used in this provider, pages handle redirects

  useEffect(() => {
    console.log("AuthProvider: Mounting onAuthStateChanged listener.");
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log("AuthProvider: onAuthStateChanged event. Firebase user:", firebaseUser ? firebaseUser.uid : 'null');
      if (firebaseUser) {
        if (!firebaseUser.email || typeof firebaseUser.email !== 'string' || firebaseUser.email.trim() === '') {
          console.error(`CRITICAL: Firebase user (UID: ${firebaseUser.uid}) has an invalid or missing email. Auth processing stopped.`);
          setUser(null);
          setLoading(false);
          localStorage.removeItem(SIGNUP_ROLE_KEY);
          return;
        }

        let determinedRole: UserRole = 'user'; // Default
        // firebaseUser.displayName might be null immediately after signup if updateProfile hasn't propagated
        let userName = firebaseUser.displayName || firebaseUser.email.split('@')[0] || 'User';
        
        let existingProfile: (FirestoreUserProfile & { id: string }) | null = null;
        try {
          existingProfile = await getUserProfile(firebaseUser.uid);
          console.log(`[AuthProvider] Fetched existing profile for ${firebaseUser.uid}:`, existingProfile ? existingProfile.role : 'No profile found');
        } catch (e) {
          console.error("[AuthProvider] Error fetching existing profile during auth state change:", e);
        }

        if (firebaseUser.email === 'hello@thelifecoachingcafe.com') {
          determinedRole = 'admin';
          userName = 'Admin User'; // Override name for admin
        } else if (existingProfile) {
          determinedRole = existingProfile.role;
          userName = existingProfile.name || userName; // Prefer name from existing profile
        } else {
          // No existing profile, this could be a new signup or first login after manual auth creation
          const signupRoleAttempt = localStorage.getItem(SIGNUP_ROLE_KEY) as UserRole | null;
          if (signupRoleAttempt) {
            determinedRole = signupRoleAttempt;
            console.log(`[AuthProvider] Role for new user ${firebaseUser.email} from localStorage: ${determinedRole}`);
          } else {
            determinedRole = 'user'; // Fallback
            console.warn(`[AuthProvider] No localStorage role for new user ${firebaseUser.email} and no existing profile, defaulting to 'user'. This might happen if signup flow was interrupted.`);
          }
        }
        
        const appUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          role: determinedRole,
          name: userName, // Use name derived from displayName or email prefix
          profileImageUrl: firebaseUser.photoURL || undefined,
        };
        setUser(appUser);
        console.log("[AuthProvider] App user context set:", JSON.stringify(appUser, null, 2));

        if (!existingProfile) {
          console.log(`[AuthProvider] No existing profile found for ${firebaseUser.uid}. Attempting to create initial profile in Firestore with role: ${determinedRole}.`);
          try {
            // Name used here should be the one from firebaseUser.displayName if available,
            // which signupUser function tries to set.
            const initialProfileData: Partial<FirestoreUserProfile> = {
              name: userName, // This userName is derived from firebaseUser.displayName or email prefix
              email: firebaseUser.email!,
              role: determinedRole,
              profileImageUrl: firebaseUser.photoURL || null,
              subscriptionTier: determinedRole === 'coach' ? 'free' : undefined,
            };
             if (determinedRole !== 'coach') {
              delete initialProfileData.subscriptionTier;
            }
            console.log("[AuthProvider] Data for initial Firestore profile (from onAuthStateChanged):", initialProfileData);
            await setUserProfile(firebaseUser.uid, initialProfileData);
            console.log(`[AuthProvider] Initial Firestore profile CREATED for ${firebaseUser.email} with role ${determinedRole}.`);
            localStorage.removeItem(SIGNUP_ROLE_KEY); // Clean up role hint
          } catch (profileError) {
            console.error(`[AuthProvider] Error CREATING initial Firestore profile for ${firebaseUser.email}:`, profileError);
          }
        } else if (existingProfile && existingProfile.role !== determinedRole && determinedRole === 'admin') {
            // Special case: if user is admin by email but Firestore profile has different role, update it.
            console.log(`[AuthProvider] Admin user ${firebaseUser.email} has role ${existingProfile.role} in Firestore. Updating to 'admin'.`);
            try {
                await updateDoc(doc(db, "users", firebaseUser.uid), { role: 'admin', updatedAt: serverTimestamp() });
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
      // onAuthStateChanged will handle setting user context and Firestore profile checks/updates
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
      localStorage.setItem(SIGNUP_ROLE_KEY, role); // Still useful for onAuthStateChanged fallback
      
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      console.log(`[AuthProvider] Firebase Auth user CREATED: ${userCredential.user.uid} for email ${email}`);

      await updateProfile(userCredential.user, { displayName: name });
      console.log(`[AuthProvider] Firebase Auth profile updated with displayName: ${name}`);
      
      // Immediately create the Firestore document with the correct name from the form
      const initialProfileData: Partial<FirestoreUserProfile> = {
        name: name, // Use the name from the signup form directly
        email: userCredential.user.email!,
        role: role,
        profileImageUrl: userCredential.user.photoURL || null,
        subscriptionTier: role === 'coach' ? 'free' : undefined,
      };
      if (role !== 'coach') {
        delete initialProfileData.subscriptionTier;
      }

      console.log("[AuthProvider] signupUser: Data for initial Firestore profile (direct call):", initialProfileData);
      await setUserProfile(userCredential.user.uid, initialProfileData);
      console.log(`[AuthProvider] signupUser: Initial Firestore profile CREATED directly for ${email} with role ${role} and correct name.`);
      
      // onAuthStateChanged will still run and should find this profile,
      // or update it if there are minor discrepancies (e.g., if photoURL propagates by then).
      // It will also handle setting the user context.

      // setLoading(false) will be handled by onAuthStateChanged finishing.
      return role;
    } catch (error: any) {
      setLoading(false);
      console.error("[AuthProvider] Firebase signup error:", error.code, error.message);
      localStorage.removeItem(SIGNUP_ROLE_KEY);
      throw error;
    }
  };

  const logoutUser = async () => {
    setLoading(true);
    console.log("[AuthProvider] logoutUser attempting.");
    try {
      await signOut(auth);
      console.log("[AuthProvider] Firebase signOut successful.");
      // onAuthStateChanged will set user to null
    } catch (error: any) {
      setLoading(false);
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
