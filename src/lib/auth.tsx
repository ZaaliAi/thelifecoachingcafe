
"use client";

import type { User, UserRole, FirestoreUserProfile, CoachStatus } from '@/types';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { auth, db } from './firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
  type User as FirebaseUser
} from 'firebase/auth';
import { setUserProfile, getUserProfile } from './firestore'; // Ensure getUserProfile is imported
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, role: UserRole) => Promise<UserRole | null>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PENDING_COACH_PROFILE_KEY = 'coachconnect-pending-coach-profile';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[AuthProvider] Mounting onAuthStateChanged listener.");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log("[AuthProvider] onAuthStateChanged event. Firebase user:", firebaseUser ? firebaseUser.uid : 'null');
      if (firebaseUser) {
        if (!firebaseUser.email || typeof firebaseUser.email !== 'string' || firebaseUser.email.trim() === '') {
          console.error("[AuthProvider] CRITICAL: Firebase user object (UID: " + firebaseUser.uid + ") has an invalid or missing email during onAuthStateChanged. Aborting profile processing.");
          setUser(null);
          setLoading(false);
          return;
        }
        const validEmail = firebaseUser.email;
        let profileNeedsCreationDueToSignup = false;
        let determinedRole: UserRole = 'user'; // Default
        let userName = firebaseUser.displayName || validEmail.split('@')[0] || 'User';
        
        const pendingProfileRaw = localStorage.getItem(PENDING_COACH_PROFILE_KEY);
        let pendingProfile: {name: string, role: UserRole} | null = null;
        if(pendingProfileRaw) {
            try {
                pendingProfile = JSON.parse(pendingProfileRaw);
            } catch (e) { console.error("Error parsing pending profile from localStorage", e)}
        }

        if (pendingProfile && firebaseUser.email === validEmail) { // Check if email matches to be sure
          determinedRole = pendingProfile.role;
          userName = pendingProfile.name; // Use name from signup form
          profileNeedsCreationDueToSignup = true;
          console.log(`[AuthProvider] Pending profile detected from localStorage: role ${determinedRole}, name ${userName} for ${validEmail}`);
        } else if (validEmail === 'hello@thelifecoachingcafe.com') {
            determinedRole = 'admin';
            userName = 'Admin User';
        }

        try {
          const userProfile = await getUserProfile(firebaseUser.uid);
          
          if (userProfile) {
            console.log(`[AuthProvider] Existing Firestore profile found for ${validEmail}:`, JSON.stringify(userProfile, null, 2));
            const appUser: User = {
              id: firebaseUser.uid,
              email: userProfile.email, // Use email from Firestore profile
              role: userProfile.role,   // Use role from Firestore profile
              name: userProfile.name || userName, // Prefer Firestore name
            };
            setUser(appUser);
            console.log("[AuthProvider] App user context SET from existing Firestore profile:", JSON.stringify(appUser, null, 2));
            if (pendingProfile) localStorage.removeItem(PENDING_COACH_PROFILE_KEY); // Clean up
          } else if (profileNeedsCreationDueToSignup) {
            console.log(`[AuthProvider] No Firestore profile for new signup ${validEmail} (UID: ${firebaseUser.uid}). Creating profile with role: ${determinedRole}, name: ${userName}.`);
            
            const dataForFirestore: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>> = {
              name: userName,
              email: validEmail,
              role: determinedRole,
              profileImageUrl: firebaseUser.photoURL || null, // Always include, defaulting to null
            };

            if (determinedRole === 'coach') {
              dataForFirestore.subscriptionTier = 'free';
              dataForFirestore.status = 'pending_approval'; // Set initial status for coaches
            }
            
            console.log("[AuthProvider] Calling setUserProfile for new user with data:", JSON.stringify(dataForFirestore, null, 2));
            await setUserProfile(firebaseUser.uid, dataForFirestore); // This creates the doc with timestamps
            
            const appUser: User = { id: firebaseUser.uid, email: validEmail, role: determinedRole, name: userName };
            setUser(appUser);
            console.log("[AuthProvider] New Firestore profile created & app user context SET for signup:", JSON.stringify(appUser, null, 2));
            localStorage.removeItem(PENDING_COACH_PROFILE_KEY); // Clean up
          } else {
            console.warn(`[AuthProvider] User ${validEmail} (UID: ${firebaseUser.uid}) is authenticated but has no Firestore profile and not a fresh signup. Creating a default 'user' profile.`);
             const defaultProfileData: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>> = {
              name: userName,
              email: validEmail,
              role: 'user', 
              profileImageUrl: firebaseUser.photoURL || null,
            };
            await setUserProfile(firebaseUser.uid, defaultProfileData);
            const appUser: User = { id: firebaseUser.uid, email: validEmail, role: 'user', name: userName };
            setUser(appUser);
            console.log("[AuthProvider] Default 'user' Firestore profile created and app user context set.");
          }
        } catch (profileError) {
          console.error("[AuthProvider] Error processing user profile in onAuthStateChanged:", profileError);
          setUser(null); 
        }
      } else { 
        setUser(null);
        console.log("[AuthProvider] No Firebase user, app user context set to null.");
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
      console.log(`[AuthProvider] Firebase signInWithEmailAndPassword successful for ${email}. Waiting for onAuthStateChanged.`);
    } catch (error: any) {
      setLoading(false); 
      console.error("[AuthProvider] Firebase login error:", error.code, error.message);
      throw error; 
    }
  };

  const signupUser = async (name: string, email: string, pass: string, role: UserRole): Promise<UserRole | null> => {
    setLoading(true);
    console.log(`[AuthProvider] signupUser: Attempting for ${email} as ${role} with name: ${name}`);
    try {
      // Store intended role and name to be picked up by onAuthStateChanged
      localStorage.setItem(PENDING_COACH_PROFILE_KEY, JSON.stringify({ name, role, email }));

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      console.log(`[AuthProvider] signupUser: Firebase Auth user CREATED: ${firebaseUser.uid} for email ${email}`);

      await updateFirebaseProfile(firebaseUser, { displayName: name });
      console.log(`[AuthProvider] signupUser: Firebase Auth profile updated with displayName: ${name}`);
      
      // The onAuthStateChanged listener will now handle Firestore profile creation
      // using the details from localStorage and the firebaseUser object.
      // We return the role for immediate redirection logic on the signup page.
      return role;
    } catch (error: any) {
      setLoading(false);
      console.error("[AuthProvider] Firebase signup error:", error.code, error.message);
      localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
      throw error; 
    }
  };

  const logoutUser = async () => {
    console.log("[AuthProvider] logoutUser attempting.");
    setLoading(true);
    try {
      await signOut(auth);
      console.log("[AuthProvider] Firebase signOut successful.");
    } catch (error: any) {
      console.error("[AuthProvider] Firebase logout error:", error);
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
