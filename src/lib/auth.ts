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
  type User as FirebaseUserAuth, // Renamed to avoid conflict with our FirebaseUser type
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { firebaseApp } from './firebase'; // Your existing firebase app initialization
import type { FirestoreUserProfile, FirebaseUser } from '@/types'; // Assuming your custom FirebaseUser type is here
import { sendWelcomeEmail } from './emailService';

interface AuthContextType {
  user: FirebaseUser | null; // Using your custom FirebaseUser type
  loading: boolean;
  error: Error | null;
  registerWithEmailAndPassword: (
    email: string, 
    password: string, 
    name: string, 
    role: 'coach' | 'user' | 'admin', // Define specific roles
    additionalData?: Partial<FirestoreUserProfile> // For other initial data like planId
  ) => Promise<FirebaseUserAuth | void>;
  loginWithEmailAndPassword: (email: string, password: string) => Promise<FirebaseUserAuth | void>;
  logout: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  // Add other auth functions as needed (e.g., signInWithGoogle)
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const auth = getAuth(firebaseApp);
    const db = getFirestore(firebaseApp);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUserAuth) => {
        setLoading(true);
        setError(null);
        if (firebaseUserAuth) {
          try {
            const userDocRef = doc(db, 'users', firebaseUserAuth.uid); // Reverted to 'users'
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
              const firestoreProfile = userDocSnap.data() as FirestoreUserProfile;
              // Combine Firebase Auth data with Firestore profile data
              setUser({
                id: firebaseUserAuth.uid,
                uid: firebaseUserAuth.uid, // uid is often used interchangeably with id
                email: firebaseUserAuth.email,
                displayName: firebaseUserAuth.displayName,
                photoURL: firebaseUserAuth.photoURL,
                emailVerified: firebaseUserAuth.emailVerified,
                // Spread Firestore profile data, ensuring types match FirebaseUser
                ...firestoreProfile,
                // Ensure all required fields from FirebaseUser are present
                name: firestoreProfile.name || firebaseUserAuth.displayName || '',
                role: firestoreProfile.role || 'user', // Default to 'user' if not in Firestore
                // Add other merged fields as necessary
              } as FirebaseUser);
            } else {
              // This case might happen if a user exists in Auth but not in Firestore
              // You might want to create a default profile or log an error
              console.warn(`User ${firebaseUserAuth.uid} exists in Auth but not in Firestore. Logging them out.`);
              await signOut(auth); // Or create a default profile
              setUser(null);
            }
          } catch (e: any) {
            console.error("Error fetching user profile from Firestore:", e);
            setError(e);
            setUser(null); // Clear user on error fetching profile
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

      // Create user profile in Firestore
      const userProfile: FirestoreUserProfile = {
        id: userCredential.user.uid,
        uid: userCredential.user.uid,
        email: email.toLowerCase(),
        name: name,
        role: role,
        createdAt: new Date(),
        status: 'active',
        photoURL: null, // Or userCredential.user.photoURL if available and desired
        // Add any other default fields from FirestoreUserProfile
        bio: '',
        specialties: [],
        keywords: [],
        // ... include all fields required by FirestoreUserProfile, possibly from additionalData
        ...additionalData, // Spread additional data like planId or other initial settings
      };

      await setDoc(doc(db, "users", userCredential.user.uid), userProfile); // Reverted to "users"
      
      if (role === 'coach') {
        await sendWelcomeEmail(email, name);
      }

      // The onAuthStateChanged listener will pick up the new user and set the user state
      // No need to call setUser directly here unless you want immediate state update before listener fires
      console.log("User registered and profile created:", userCredential.user.uid);
      setLoading(false);
      return userCredential.user;
    } catch (e: any) {
      console.error("Error during registration:", e);
      setError(e);
      setLoading(false);
      throw e; // Re-throw to be caught by the calling component
    }
  };

  const loginWithEmailAndPassword = async (email: string, password: string): Promise<FirebaseUserAuth | void> => {
    setLoading(true);
    setError(null);
    const auth = getAuth(firebaseApp);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle setting the user state
      setLoading(false);
      return userCredential.user;
    } catch (e: any) {
      console.error("Error during login:", e);
      setError(e);
      setLoading(false);
      throw e; // Re-throw
    }
  };

  const logout = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    const auth = getAuth(firebaseApp);
    try {
      await signOut(auth);
      // onAuthStateChanged will set user to null
      setLoading(false);
    } catch (e: any) {
      console.error("Error during logout:", e);
      setError(e);
      setLoading(false);
      throw e; // Re-throw
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
