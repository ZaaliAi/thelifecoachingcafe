
"use client";

import type { User, UserRole, FirestoreUserProfile } from '@/types';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { auth } from './firebase'; // db is needed for Firestore operations
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
import { setUserProfile, getUserProfile } from './firestore';
import { serverTimestamp } from 'firebase/firestore';


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
  const router = useRouter();

  useEffect(() => {
    console.log("AuthProvider: Mounting onAuthStateChanged listener.");
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log("AuthProvider: onAuthStateChanged event. Firebase user:", firebaseUser ? firebaseUser.email : 'null');
      if (firebaseUser) {
        if (!firebaseUser.email || typeof firebaseUser.email !== 'string' || firebaseUser.email.trim() === '') {
          console.error(`CRITICAL: Firebase user object (UID: ${firebaseUser.uid}) has an invalid or missing email after auth state change. This should not happen for email/password auth. User will not be processed further.`);
          setUser(null);
          setLoading(false);
          localStorage.removeItem(SIGNUP_ROLE_KEY);
          localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
          return;
        }

        let determinedRole: UserRole = 'user'; // Default
        let userName = firebaseUser.displayName || firebaseUser.email.split('@')[0] || 'User';
        let profileNeedsCreationDueToSignup = false;
        let existingProfile: (FirestoreUserProfile & { id: string }) | null = null;

        // Attempt to fetch existing profile first
        try {
          existingProfile = await getUserProfile(firebaseUser.uid);
        } catch (e) {
          console.error("AuthProvider: Error fetching existing profile during auth state change:", e);
          // Proceed, maybe profile doesn't exist yet
        }

        if (firebaseUser.email === 'hello@thelifecoachingcafe.com') {
          determinedRole = 'admin';
          userName = 'Admin User';
        } else if (existingProfile) {
          determinedRole = existingProfile.role;
          userName = existingProfile.name || userName;
          console.log(`AuthProvider: Role for existing user ${firebaseUser.email} from Firestore: ${determinedRole}`);
        } else {
          // No existing profile, this might be a new signup
          profileNeedsCreationDueToSignup = true;
          const signupRoleAttempt = localStorage.getItem(SIGNUP_ROLE_KEY) as UserRole | null;
          if (signupRoleAttempt) {
            determinedRole = signupRoleAttempt;
            console.log(`AuthProvider: Role for new user ${firebaseUser.email} from localStorage: ${determinedRole}`);
          } else {
            // Fallback if no signup role found (should be rare if signup flow is correct)
            determinedRole = 'user';
            console.log(`AuthProvider: No localStorage role for new user ${firebaseUser.email}, defaulting to 'user'.`);
          }
        }

        const appUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          role: determinedRole,
          name: userName,
          profileImageUrl: firebaseUser.photoURL || undefined,
        };
        setUser(appUser);
        console.log("AuthProvider: App user context set:", JSON.stringify(appUser, null, 2));

        if (profileNeedsCreationDueToSignup || (existingProfile && existingProfile.role !== determinedRole)) {
          console.log(`AuthProvider: Triggering profile creation/update in Firestore for ${firebaseUser.email} with role ${determinedRole}. Needs creation: ${profileNeedsCreationDueToSignup}`);
          try {
            // Prepare the EXACT data structure for initial Firestore document creation
            // based on the 'hasOnly' clause in your security rules.
            const dataForFirestore: Partial<Omit<FirestoreUserProfile, 'id'|'createdAt'|'updatedAt'>> = {
              name: userName,
              email: firebaseUser.email, // firebaseUser.email is guaranteed non-null here
              role: determinedRole,
              profileImageUrl: firebaseUser.photoURL || null, // Ensure it's null, not undefined
            };

            if (determinedRole === 'coach') {
              dataForFirestore.subscriptionTier = 'free'; // Coaches get 'free' tier by default
            }
            // For 'user' or 'admin', subscriptionTier is NOT included, aligning with hasOnly rule.
            // profileImageUrl is included (or null) for all roles as per hasOnly in your rule.

            console.log("[AuthProvider] About to call setUserProfile for new user/role update with data:", JSON.stringify(dataForFirestore, null, 2));
            await setUserProfile(firebaseUser.uid, dataForFirestore); // This will add createdAt/updatedAt
            console.log(`AuthProvider: User profile CREATED/MERGED in Firestore for ${firebaseUser.email} with role ${determinedRole}`);
            
            if (localStorage.getItem(SIGNUP_ROLE_KEY)) {
              localStorage.removeItem(SIGNUP_ROLE_KEY);
              console.log("AuthProvider: Removed SIGNUP_ROLE_KEY from localStorage after profile creation/update.");
            }
          } catch (profileError) {
            console.error(`AuthProvider: Error CREATING/MERGING user profile in Firestore for ${firebaseUser.email}:`, profileError);
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
      // onAuthStateChanged will handle setting user context and Firestore profile checks/updates
      console.log(`AuthProvider: signInWithEmailAndPassword successful for ${email}. Waiting for onAuthStateChanged.`);
    } catch (error: any) {
      setLoading(false); // Set loading false only on error here, onAuthStateChanged handles success
      console.error("AuthProvider: Firebase login error:", error.code, error.message);
      throw error;
    }
  };

  const signupUser = async (name: string, email: string, pass: string, role: UserRole): Promise<UserRole | null> => {
    setLoading(true);
    console.log(`AuthProvider: signupUser attempting for ${email} as ${role}`);
    try {
      // Store intended role before Firebase Auth creation
      localStorage.setItem(SIGNUP_ROLE_KEY, role);
      console.log(`AuthProvider: Set SIGNUP_ROLE_KEY to ${role} for ${email}`);

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      console.log(`AuthProvider: Firebase Auth user CREATED: ${userCredential.user.uid} for email ${email}`);

      await updateProfile(userCredential.user, { displayName: name });
      console.log(`AuthProvider: Firebase Auth profile updated with displayName: ${name}`);
      
      // No need to explicitly store PENDING_COACH_PROFILE_KEY if onAuthStateChanged handles everything.
      // The onAuthStateChanged listener will now pick up this new user,
      // see there's no Firestore profile, read SIGNUP_ROLE_KEY, and call setUserProfile.
      
      // setLoading(false) will be handled by onAuthStateChanged
      return role; 
    } catch (error: any) {
      setLoading(false);
      console.error("Firebase signup error:", error.code, error.message);
      localStorage.removeItem(SIGNUP_ROLE_KEY); // Clean up if signup fails
      localStorage.removeItem(PENDING_COACH_PROFILE_KEY); // Clean up if signup fails
      throw error; 
    }
  };

  const logoutUser = async () => {
    setLoading(true); // setLoading true before async operation
    console.log("AuthProvider: logoutUser attempting.");
    try {
      await signOut(auth);
      // onAuthStateChanged will set user to null and clear localStorage keys.
      console.log("AuthProvider: Firebase signOut successful.");
      // setLoading(false) will be handled by onAuthStateChanged
    } catch (error: any) {
      setLoading(false); // Set loading false on error
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
