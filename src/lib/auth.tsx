"use client";

import type { User, UserRole, FirestoreUserProfile } from '@/types';
import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
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

interface AuthContextType {
  user: User | null; // This will hold the combined user and profile data
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, role: UserRole, additionalData?: Partial<FirestoreUserProfile>) => Promise<FirebaseUser>;
  logout: () => Promise<void>;
  refetchUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAndSetUser = useCallback(async (fbUser: FirebaseUser) => {
    const userProfile = await getUserProfile(fbUser.uid);
    if (userProfile) {
      const combinedUser: User = {
        id: fbUser.uid,
        email: userProfile.email || fbUser.email!,
        role: userProfile.role,
        name: userProfile.name || fbUser.displayName || 'User',
        profileImageUrl: userProfile.profileImageUrl || fbUser.photoURL || undefined,
        subscriptionTier: userProfile.subscriptionTier,
        ...userProfile,
      };
      setUser(combinedUser);
    } else {
      // If profile doesn't exist, this might be a transient state during signup.
      // Setting user to null can cause redirects. Let's keep the old user state for a moment.
      console.warn(`User profile not found for uid: ${fbUser.uid}. This may be a race condition during signup.`);
      setUser(null); // Or handle this more gracefully
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentFirebaseUser) => {
      setLoading(true);
      if (currentFirebaseUser) {
        setFirebaseUser(currentFirebaseUser);
        await fetchAndSetUser(currentFirebaseUser);
      } else {
        setFirebaseUser(null);
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchAndSetUser]);

  const refetchUserProfile = useCallback(async () => {
    if (firebaseUser) {
        setLoading(true);
        await fetchAndSetUser(firebaseUser);
        setLoading(false);
    }
  }, [firebaseUser, fetchAndSetUser]);

  const login = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const signup = async (name: string, email: string, pass: string, role: UserRole, additionalData?: Partial<FirestoreUserProfile>): Promise<FirebaseUser> => {
    // 1. Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const newFirebaseUser = userCredential.user;

    // 2. Update their display name in Firebase Auth
    await updateFirebaseProfile(newFirebaseUser, { displayName: name });
    
    // 3. Prepare the user profile for Firestore
    const initialProfileData: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>> = {
        name,
        email,
        role,
        ...additionalData
    };
    if (role === 'coach') {
        initialProfileData.subscriptionTier = 'free';
        initialProfileData.status = 'pending';
    }

    // 4. Save the profile to Firestore
    await setUserProfile(newFirebaseUser.uid, initialProfileData);

    // 5. Manually update the auth context state to AVOID race conditions.
    // This is the key change: we wait for the user profile to be created
    // and then explicitly update our application's state.
    await fetchAndSetUser(newFirebaseUser);

    // 6. Return the firebase user object
    return newFirebaseUser;
  };

  const logout = async () => {
    await signOut(auth);
  };
  
  const contextValue = {
    user,
    firebaseUser,
    loading,
    login,
    signup,
    logout,
    refetchUserProfile,
  };

  return (
    <AuthContext.Provider value={contextValue}>
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
