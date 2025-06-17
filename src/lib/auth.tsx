"use client";

import type { User, UserRole, FirestoreUserProfile, CoachStatus } from '@/types';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { auth } from './firebase'; 
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
  type User as FirebaseUser
} from 'firebase/auth';
import { setUserProfile, getUserProfile } from './firestore';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'; 
import { db } from './firebase'; 

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null; // <-- Add this line
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, role: UserRole, additionalData?: Partial<FirestoreUserProfile>) => Promise<FirebaseUser | null>;
  logout: () => Promise<void>;
  loading: boolean;
  getFirebaseAuthToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SIGNUP_ROLE_KEY = 'coachconnect-signup-role';
const SIGNUP_NAME_KEY = 'coachconnect-signup-name';
const SIGNUP_ADDITIONAL_DATA_KEY = 'coachconnect-signup-additionaldata';


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUserSt, setFirebaseUserSt] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[AuthProvider] Mounting onAuthStateChanged listener.");
    const unsubscribe = onAuthStateChanged(auth, async (currentFirebaseUser: FirebaseUser | null) => {
      console.log("[AuthProvider] onAuthStateChanged event. Firebase user:", currentFirebaseUser ? currentFirebaseUser.uid : 'null');
      setFirebaseUserSt(currentFirebaseUser);

      if (currentFirebaseUser) {
        if (!currentFirebaseUser.email || typeof currentFirebaseUser.email !== 'string' || currentFirebaseUser.email.trim() === '') {
          console.error("[AuthProvider] CRITICAL: Firebase user object (UID: " + currentFirebaseUser.uid + ") has an invalid or missing email during onAuthStateChanged. Aborting profile processing.");
          setUser(null); 
          setLoading(false);
          return; 
        }
        const validEmail = currentFirebaseUser.email;

        let determinedRole: UserRole = 'user'; 
        let userName = currentFirebaseUser.displayName || validEmail.split('@')[0] || 'User';
        let profileNeedsCreationDueToSignup = false;

        if (validEmail === 'hello@thelifecoachingcafe.com') {
          determinedRole = 'admin';
          userName = 'Admin User'; 
          console.log(`[AuthProvider] Admin email detected: ${validEmail}, role set to 'admin'.`);
        } else {
          const signupRole = localStorage.getItem(SIGNUP_ROLE_KEY) as UserRole | null;
          const signupName = localStorage.getItem(SIGNUP_NAME_KEY);
          if (signupRole) {
            determinedRole = signupRole;
            if (signupName) userName = signupName;
            profileNeedsCreationDueToSignup = true; 
            console.log(`[AuthProvider] Role from localStorage: ${determinedRole} for ${validEmail}`);
          }
        }

        try {
          const userProfile = await getUserProfile(currentFirebaseUser.uid);
          
          if (userProfile) {
            console.log(`[AuthProvider] Existing Firestore profile found for ${validEmail}:`, JSON.stringify(userProfile, null, 2));
            if (validEmail === 'hello@thelifecoachingcafe.com' && userProfile.role !== 'admin') {
              console.warn(`[AuthProvider] Admin ${validEmail} had role '${userProfile.role}' in Firestore. Updating to 'admin'.`);
              const userDocRef = doc(db, "users", currentFirebaseUser.uid);
              await updateDoc(userDocRef, { role: 'admin', updatedAt: serverTimestamp() });
              userProfile.role = 'admin'; 
            }
            
            const appUser: User = {
              id: currentFirebaseUser.uid,
              email: userProfile.email || validEmail, 
              role: userProfile.role,   
              name: userProfile.name || userName, 
              profileImageUrl: userProfile.profileImageUrl || currentFirebaseUser.photoURL || undefined,
            };
            if (appUser.role === 'coach' && userProfile.subscriptionTier) {
              appUser.subscriptionTier = userProfile.subscriptionTier;
            }
            setUser(appUser);
            console.log("[AuthProvider] App user context SET from existing Firestore profile:", JSON.stringify(appUser, null, 2));
            if (profileNeedsCreationDueToSignup) { // Clear keys if profile was expected to be created but found
              localStorage.removeItem(SIGNUP_ROLE_KEY);
              localStorage.removeItem(SIGNUP_NAME_KEY);
              localStorage.removeItem(SIGNUP_ADDITIONAL_DATA_KEY);
            }
          } else if (profileNeedsCreationDueToSignup || validEmail === 'hello@thelifecoachingcafe.com') {
            console.log(`[AuthProvider] No Firestore profile for ${validEmail} (UID: ${currentFirebaseUser.uid}). Creating profile with role: ${determinedRole}, name: ${userName}.`);
            
            let signupAdditionalData: Partial<FirestoreUserProfile> = {};
            const storedAdditionalData = localStorage.getItem(SIGNUP_ADDITIONAL_DATA_KEY);
            if (storedAdditionalData) {
              try {
                signupAdditionalData = JSON.parse(storedAdditionalData);
                console.log("[AuthProvider] Successfully parsed additional signup data:", signupAdditionalData);
              } catch (e) {
                console.error("[AuthProvider] Error parsing additional signup data from localStorage:", e);
              }
              localStorage.removeItem(SIGNUP_ADDITIONAL_DATA_KEY); // Clean up after attempting to read
            }
            
            const initialProfileData: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>> = {
              name: userName,
              email: validEmail,
              role: determinedRole,
              profileImageUrl: currentFirebaseUser.photoURL || null,
              // Default coach fields (will be overridden by signupAdditionalData if present)
              ...(determinedRole === 'coach' && {
                subscriptionTier: 'free', // Default, might be overridden by signupAdditionalData
                status: 'pending', // Default, might be overridden
              }),
              ...signupAdditionalData, // Spread the additional data from the form
            };
            
            console.log("[AuthProvider] Calling setUserProfile for new user with initialProfileData:", JSON.stringify(initialProfileData, null, 2));
            await setUserProfile(currentFirebaseUser.uid, initialProfileData); 
            
            const appUser: User = { 
              id: currentFirebaseUser.uid, 
              email: validEmail, 
              role: determinedRole, 
              name: userName,
              profileImageUrl: initialProfileData.profileImageUrl || undefined,
            };
            if (appUser.role === 'coach' && initialProfileData.subscriptionTier) {
              appUser.subscriptionTier = initialProfileData.subscriptionTier as 'free' | 'premium' | 'enterprise';
            }
            setUser(appUser);
            console.log("[AuthProvider] New Firestore profile created & app user context SET:", JSON.stringify(appUser, null, 2));
            localStorage.removeItem(SIGNUP_ROLE_KEY);
            localStorage.removeItem(SIGNUP_NAME_KEY);
            // SIGNUP_ADDITIONAL_DATA_KEY already removed above
          } else {
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
        localStorage.removeItem(SIGNUP_ADDITIONAL_DATA_KEY);
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

  const signupUser = async (name: string, email: string, pass: string, role: UserRole, additionalData?: Partial<FirestoreUserProfile>): Promise<FirebaseUser | null> => {
    setLoading(true);
    console.log(`[AuthProvider] signupUser: Attempting for ${email} as ${role} with name: ${name}`);
    try {
      localStorage.setItem(SIGNUP_ROLE_KEY, role);
      localStorage.setItem(SIGNUP_NAME_KEY, name);
      if (additionalData) {
        localStorage.setItem(SIGNUP_ADDITIONAL_DATA_KEY, JSON.stringify(additionalData));
        console.log('[AuthProvider] Stored additional signup data to localStorage:', additionalData);
      } else {
        localStorage.removeItem(SIGNUP_ADDITIONAL_DATA_KEY); // Clear if no data, though form should send it
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const newFirebaseUser = userCredential.user;
      console.log(`[AuthProvider] signupUser: Firebase Auth user CREATED: ${newFirebaseUser.uid} for email ${email}`);

      await updateFirebaseProfile(newFirebaseUser, { displayName: name });
      console.log(`[AuthProvider] signupUser: Firebase Auth profile updated with displayName: ${name}`);
      
      // onAuthStateChanged will handle Firestore profile creation using localStorage data.
      return newFirebaseUser; // Return the full FirebaseUser object
    } catch (error: any) {
      setLoading(false);
      console.error("[AuthProvider] Firebase signup error:", error.code, error.message);
      localStorage.removeItem(SIGNUP_ROLE_KEY); 
      localStorage.removeItem(SIGNUP_NAME_KEY);
      localStorage.removeItem(SIGNUP_ADDITIONAL_DATA_KEY);
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

  const providerValue = { user, firebaseUser: firebaseUserSt, login: loginUser, signup: signupUser, logout: logoutUser, loading, getFirebaseAuthToken };

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
