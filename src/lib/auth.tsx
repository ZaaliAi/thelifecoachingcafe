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
  user: User | null; 
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, role: UserRole, additionalData?: Partial<FirestoreUserProfile>) => Promise<FirebaseUser>;
  logout: () => Promise<void>;
  refetchUserProfile: () => Promise<void>;
  getFirebaseAuthToken: () => Promise<string | null>;
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
      console.warn(`User profile not found for uid: ${fbUser.uid}. This may be a race condition during signup.`);
      setUser(null); 
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

  const getFirebaseAuthToken = async (): Promise<string | null> => {
    if (auth.currentUser) {
        try {
            return await auth.currentUser.getIdToken(true);
        } catch (error) {
            console.error("Error getting Firebase ID token:", error);
            return null;
        }
    }
    return null;
  };

  const signup = async (name: string, email: string, pass: string, role: UserRole, additionalData?: Partial<FirestoreUserProfile>): Promise<FirebaseUser> => {
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const newFirebaseUser = userCredential.user;

    await updateFirebaseProfile(newFirebaseUser, { displayName: name });
    
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

    await setUserProfile(newFirebaseUser.uid, initialProfileData);

    await fetchAndSetUser(newFirebaseUser);

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
    getFirebaseAuthToken,
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
