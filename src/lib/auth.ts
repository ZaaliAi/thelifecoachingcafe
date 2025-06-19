'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  type User as FirebaseUserAuth,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { firebaseApp } from './firebase';
import type { FirestoreUserProfile, FirebaseUser } from '@/types';
import { sendWelcomeEmail } from './emailService';


interface AuthContextType {
  user: FirebaseUser | null;
  firebaseUser: FirebaseUserAuth | null;
  loading: boolean;
  error: Error | null;
  registerWithEmailAndPassword: (
    email: string,
    password: string,
    name: string,
    role: 'coach' | 'user' | 'admin',
    additionalData?: Partial<FirestoreUserProfile>
  ) => Promise<FirebaseUserAuth | void>;
  loginWithEmailAndPassword: (email: string, password: string) => Promise<FirebaseUserAuth | void>;
  logout: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUserAuth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const db = getFirestore(firebaseApp);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUserAuth) => {
        setFirebaseUser(firebaseUserAuth);
        setLoading(true);
        setError(null);
        if (firebaseUserAuth) {
          try {
            const userDocRef = doc(db, 'users', firebaseUserAuth.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const firestoreProfile = userDocSnap.data() as FirestoreUserProfile;
              setUser({
                id: firebaseUserAuth.uid,
                uid: firebaseUserAuth.uid,
                email: firebaseUserAuth.email,
                displayName: firebaseUserAuth.displayName,
                profileImageUrl: firebaseUserAuth.profileImageUrl,
                emailVerified: firebaseUserAuth.emailVerified,
                ...firestoreProfile,
                name: firestoreProfile.name || firebaseUserAuth.displayName || '',
                role: firestoreProfile.role || 'user',
              } as FirebaseUser);
            } else {
              console.warn(`User ${firebaseUserAuth.uid} exists in Auth but not in Firestore. Logging them out.`);
              await signOut(auth);
              setUser(null);
            }
          } catch (e: any) {
            console.error("Error fetching user profile from Firestore:", e);
            setError(e);
            setUser(null);
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      },
      (authError) => {
        console.error("Error from onAuthStateChanged listener:", authError);
        setError(authError);
        setUser(null);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const registerWithEmailAndPassword = async (
    email: string,
    password: string,
    name: string,
    role: 'coach' | 'user' | 'admin',
    additionalData: Partial<FirestoreUserProfile> = {}
  ): Promise<FirebaseUserAuth | void> => {
    setLoading(true);
    setError(null);
    const auth = getAuth(firebaseApp);
    const db = getFirestore(firebaseApp);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });

      const userProfile: FirestoreUserProfile = {
        id: userCredential.user.uid,
        uid: userCredential.user.uid,
        email: email.toLowerCase(),
        name: name,
        role: role,
        createdAt: new Date(),
        status: 'active',
        profileImageUrl: null,
        bio: '',
        specialties: [],
        keywords: [],
        ...additionalData,
      };

      await setDoc(doc(db, "users", userCredential.user.uid), userProfile);

      if (role === 'coach') {
        await sendWelcomeEmail(email, name);
      }

      console.log("User registered and profile created:", userCredential.user.uid);
      setLoading(false);
      return userCredential.user;
    } catch (e: any) {
      console.error("Error during registration:", e);
      setError(e);
      setLoading(false);
      throw e;
    }
  };

  const loginWithEmailAndPassword = async (email: string, password: string): Promise<FirebaseUserAuth | void> => {
    setLoading(true);
    setError(null);
    const auth = getAuth(firebaseApp);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setLoading(false);
      return userCredential.user;
    } catch (e: any) {
      console.error("Error during login:", e);
      setError(e);
      setLoading(false);
      throw e;
    }
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const auth = getAuth(firebaseApp);
    try {
      await signOut(auth);
      setLoading(false);
    } catch (e: any) {
      console.error("Error during logout:", e);
      setError(e);
      setLoading(false);
      throw e;
    }
  };

  const sendPasswordResetEmail = async (email: string): Promise<void> => {
    const auth = getAuth(firebaseApp);
    try {
      await firebaseSendPasswordResetEmail(auth, email);
    } catch (e: any) {
      console.error("Error sending password reset email:", e);
      throw e;
    }
  };

  const value = {
    user,
    firebaseUser,
    loading,
    error,
    registerWithEmailAndPassword,
    loginWithEmailAndPassword,
    logout,
    sendPasswordResetEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
