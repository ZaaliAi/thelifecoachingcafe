
"use client";

import type { User, UserRole, FirestoreUserProfile, CoachStatus } from '@/types';
import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react'; // Imported useCallback
import { auth } from './firebase'; // Correctly imports auth from firebase.ts
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
  type User as FirebaseUser
} from 'firebase/auth';
import { setUserProfile, getUserProfile } from './firestore';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'; // Added for potential role update
import { db } from './firebase'; // Added for doc reference

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, role: UserRole) => Promise<UserRole | null>;
  logout: () => Promise<void>;
  loading: boolean;
  getFirebaseAuthToken: () => Promise<string | null>; // New function
  refreshUserProfile: () => Promise<void>; // Added refresh function
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SIGNUP_ROLE_KEY = 'coachconnect-signup-role';
const SIGNUP_NAME_KEY = 'coachconnect-signup-name';


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUserSt, setFirebaseUserSt] = useState<FirebaseUser | null>(null); // State for Firebase User
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[AuthProvider] Mounting onAuthStateChanged listener.");
    const unsubscribe = onAuthStateChanged(auth, async (currentFirebaseUser: FirebaseUser | null) => {
      console.log("[AuthProvider] onAuthStateChanged event. Firebase user:", currentFirebaseUser ? currentFirebaseUser.uid : 'null');
      setFirebaseUserSt(currentFirebaseUser); // Store the Firebase user

      if (currentFirebaseUser) {
        if (!currentFirebaseUser.email || typeof currentFirebaseUser.email !== 'string' || currentFirebaseUser.email.trim() === '') {
          console.error("[AuthProvider] CRITICAL: Firebase user object (UID: " + currentFirebaseUser.uid + ") has an invalid or missing email during onAuthStateChanged. Aborting profile processing.");
          setUser(null); // Clear any potentially bad state
          setLoading(false);
          return; // Stop processing if email is invalid
        }
        const validEmail = currentFirebaseUser.email;

        let determinedRole: UserRole = 'user'; // Default role
        let userName = currentFirebaseUser.displayName || validEmail.split('@')[0] || 'User';
        let profileNeedsCreationDueToSignup = false;

        // Check for admin email first
        if (validEmail === 'hello@thelifecoachingcafe.com') {
          determinedRole = 'admin';
          userName = 'Admin User'; // Or fetch name from Firestore if preferred
          console.log(`[AuthProvider] Admin email detected: ${validEmail}, role set to 'admin'.`);
        } else {
          // Check localStorage for role set during signup process
          const signupRole = localStorage.getItem(SIGNUP_ROLE_KEY) as UserRole | null;
          const signupName = localStorage.getItem(SIGNUP_NAME_KEY);
          if (signupRole) {
            determinedRole = signupRole;
            if (signupName) userName = signupName;
            profileNeedsCreationDueToSignup = true; // Flag that Firestore profile creation is expected
            console.log(`[AuthProvider] Role from localStorage: ${determinedRole} for ${validEmail}`);
          }
        }

        try {
          const userProfile = await getUserProfile(currentFirebaseUser.uid);
          
          if (userProfile) {
            console.log(`[AuthProvider] Existing Firestore profile found for ${validEmail}:`, JSON.stringify(userProfile, null, 2));
            // If admin logs in, and their Firestore role is somehow different, update it.
            // This is a safety check.
            if (validEmail === 'hello@thelifecoachingcafe.com' && userProfile.role !== 'admin') {
              console.warn(`[AuthProvider] Admin ${validEmail} had role '${userProfile.role}' in Firestore. Updating to 'admin'.`);
              const userDocRef = doc(db, "users", currentFirebaseUser.uid);
              await updateDoc(userDocRef, { role: 'admin', updatedAt: serverTimestamp() });
              userProfile.role = 'admin'; // Update local copy
            }
            
            const appUser: User = {
              id: currentFirebaseUser.uid,
              email: userProfile.email || validEmail, // Prefer Firestore email, fallback to auth email
              role: userProfile.role,   // Use role from Firestore profile
              name: userProfile.name || userName, // Prefer Firestore name
              profileImageUrl: userProfile.profileImageUrl || currentFirebaseUser.photoURL || undefined,
            };
            // Ensure subscriptionTier is included for coaches
            if (appUser.role === 'coach' && userProfile.subscriptionTier) {
              appUser.subscriptionTier = userProfile.subscriptionTier;
            }
            setUser(appUser);
            console.log("[AuthProvider] App user context SET from existing Firestore profile:", JSON.stringify(appUser, null, 2));
            if (profileNeedsCreationDueToSignup) {
              localStorage.removeItem(SIGNUP_ROLE_KEY);
              localStorage.removeItem(SIGNUP_NAME_KEY);
            }
          } else if (profileNeedsCreationDueToSignup || validEmail === 'hello@thelifecoachingcafe.com') {
            // Create profile if it's a new signup or if it's the admin user and their profile is missing
            console.log(`[AuthProvider] No Firestore profile for ${validEmail} (UID: ${currentFirebaseUser.uid}). Creating profile with role: ${determinedRole}, name: ${userName}.`);
            
            const initialProfileData: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>> = {
              name: userName,
              email: validEmail,
              role: determinedRole,
              profileImageUrl: currentFirebaseUser.photoURL || null, // Explicitly null if no photoURL
            };

            if (determinedRole === 'coach') {
              initialProfileData.subscriptionTier = 'free';
              initialProfileData.status = 'pending_approval';
            }
            
            console.log("[AuthProvider] Calling setUserProfile for new user with initialProfileData:", JSON.stringify(initialProfileData, null, 2));
            await setUserProfile(currentFirebaseUser.uid, initialProfileData); // This creates the doc with timestamps
            
            const appUser: User = { 
              id: currentFirebaseUser.uid, 
              email: validEmail, 
              role: determinedRole, 
              name: userName,
              profileImageUrl: initialProfileData.profileImageUrl || undefined,
            };
            // Ensure subscriptionTier is included for newly created coach profiles
            if (appUser.role === 'coach' && initialProfileData.subscriptionTier) {
              appUser.subscriptionTier = initialProfileData.subscriptionTier;
            }
            setUser(appUser);
            console.log("[AuthProvider] New Firestore profile created & app user context SET:", JSON.stringify(appUser, null, 2));
            localStorage.removeItem(SIGNUP_ROLE_KEY);
            localStorage.removeItem(SIGNUP_NAME_KEY);
          } else {
            // User is authenticated with Firebase Auth but has no Firestore profile and isn't a fresh signup.
            // This state should ideally not be common if signup flow is robust.
            // We might create a default 'user' profile or log an anomaly.
            console.warn(`[AuthProvider] User ${validEmail} (UID: ${currentFirebaseUser.uid}) is authenticated but has no Firestore profile and not a flagged new signup. Setting role to 'user' by default and creating profile.`);
             const defaultProfileData: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>> = {
              name: userName,
              email: validEmail,
              role: 'user', 
              profileImageUrl: currentFirebaseUser.photoURL || null,
            };
            await setUserProfile(currentFirebaseUser.uid, defaultProfileData);
            const appUser: User = { id: currentFirebaseUser.uid, email: validEmail, role: 'user', name: userName, profileImageUrl: defaultProfileData.profileImageUrl || undefined };
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
        localStorage.removeItem(SIGNUP_ROLE_KEY); 
        localStorage.removeItem(SIGNUP_NAME_KEY);
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
      // onAuthStateChanged will handle setting the user state and role based on Firestore data
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
      localStorage.setItem(SIGNUP_ROLE_KEY, role);
      localStorage.setItem(SIGNUP_NAME_KEY, name); // Store the name from form

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const newFirebaseUser = userCredential.user;
      console.log(`[AuthProvider] signupUser: Firebase Auth user CREATED: ${newFirebaseUser.uid} for email ${email}`);

      // Update Firebase Auth profile (displayName might take time to reflect in newFirebaseUser object immediately)
      await updateFirebaseProfile(newFirebaseUser, { displayName: name });
      console.log(`[AuthProvider] signupUser: Firebase Auth profile updated with displayName: ${name}`);
      
      // The onAuthStateChanged listener will now handle Firestore profile creation
      // using the details from localStorage and the newFirebaseUser object.
      // We return the role for immediate redirection logic on the signup page.
      return role;
    } catch (error: any) {
      setLoading(false);
      console.error("[AuthProvider] Firebase signup error:", error.code, error.message);
      localStorage.removeItem(SIGNUP_ROLE_KEY); 
      localStorage.removeItem(SIGNUP_NAME_KEY);
      throw error; 
    }
  };

  const logoutUser = async () => {
    console.log("[AuthProvider] logoutUser attempting.");
    setLoading(true);
    try {
      await signOut(auth);
      console.log("[AuthProvider] Firebase signOut successful.");
      // User state will be set to null by onAuthStateChanged
    } catch (error: any) {
      console.error("[AuthProvider] Firebase logout error:", error);
      setLoading(false); 
      throw error;
    }
  };

  const getFirebaseAuthToken = async (): Promise<string | null> => {
    if (firebaseUserSt) {
      try {
        const token = await firebaseUserSt.getIdToken();
        return token;
      } catch (error) {
        console.error("[AuthProvider] Error getting ID token:", error);
        return null;
      }
    }
    console.warn("[AuthProvider] getFirebaseAuthToken called but no Firebase user available.");
    return null;
  };


  const refreshUserProfile = useCallback(async () => {
    console.log("[AuthProvider] refreshUserProfile called (cached). Firebase user UID:", firebaseUserSt?.uid);
    if (!firebaseUserSt) {
      console.warn("[AuthProvider] refreshUserProfile: No Firebase user (from state), cannot refresh.");
      return;
    }

    setLoading(true);
    try {
      const userProfile = await getUserProfile(firebaseUserSt.uid);
      if (userProfile) {
        console.log(`[AuthProvider] refreshUserProfile: Fetched profile for ${firebaseUserSt.email}:`, JSON.stringify(userProfile, null, 2));
        const appUser: User = {
          id: firebaseUserSt.uid,
          email: userProfile.email || firebaseUserSt.email!, // Prefer Firestore email, fallback to auth email
          role: userProfile.role,
          name: userProfile.name || firebaseUserSt.displayName || firebaseUserSt.email!.split('@')[0] || 'User',
          profileImageUrl: userProfile.profileImageUrl || firebaseUserSt.photoURL || undefined,
        };
        if (userProfile.role === 'coach' && userProfile.subscriptionTier) {
          appUser.subscriptionTier = userProfile.subscriptionTier;
        }
        setUser(appUser);
        console.log("[AuthProvider] refreshUserProfile: App user context UPDATED:", JSON.stringify(appUser, null, 2));
      } else {
        console.warn(`[AuthProvider] refreshUserProfile: No Firestore profile found for user ${firebaseUserSt.uid}. User might need to be logged out or a default profile created.`);
        // Potentially set user to null or handle as an error state
        // For now, just log, as onAuthStateChanged handles initial creation.
      }
    } catch (error) {
      console.error("[AuthProvider] refreshUserProfile: Error fetching/updating profile:", error);
      // Decide if user state should be cleared or error handled otherwise
    } finally {
      setLoading(false);
    }
  }, [firebaseUserSt, setUser, setLoading]); // Added setUser and setLoading to dependency array as they are used. State setters are stable.

  const providerValue = { user, login: loginUser, signup: signupUser, logout: logoutUser, loading, getFirebaseAuthToken, refreshUserProfile };

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

