"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { auth } from '@/lib/firebase'; // Import the Firebase auth instance
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth'; // Import onAuthStateChanged and Firebase User type

// Keep your custom User type if you use it for other metadata,
// but the auth state will now hold the FirebaseUser.
// You might want to merge or link these if your custom User type stores profile data.
import type { User as CustomUserType, UserRole } from '@/types';

interface AuthContextType {
  user: FirebaseUser | null; // This will now be the Firebase user object
  // We'll keep your custom login/logout for now, but they need to be updated
  // to use Firebase auth methods (e.g., signInWithEmailAndPassword, signOut)
  // for this to fully work with Firebase.
  login: (email: string, role: UserRole) => void; // This will need to change
  logout: () => void; // This will need to change
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null); // State now holds FirebaseUser
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for Firebase authentication state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        console.log("Firebase Auth: User is signed in", firebaseUser.uid);
        setUser(firebaseUser); // Set the Firebase user object
      } else {
        console.log("Firebase Auth: User is signed out");
        setUser(null);
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // --- IMPORTANT ---
  // The login and logout functions below are still your MOCK implementations.
  // For the getIdToken() to work correctly after login, these functions
  // MUST be updated to use Firebase's authentication methods
  // (e.g., signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut).
  //
  // For now, this change primarily fixes getIdToken for users ALREADY signed in
  // via Firebase elsewhere, or if you manually trigger Firebase login.

  const login = (email: string, role: UserRole) => {
    console.warn("AuthContext: Mock login function called. For Firebase auth, this needs to be updated to use Firebase SDK (e.g., signInWithEmailAndPassword).");
    // This mock login will NOT give you a Firebase user with getIdToken.
    // You need to replace this with actual Firebase login.
    const mockUser: CustomUserType = {
      id: Date.now().toString(),
      email,
      role,
      name: email.split('@')[0]
    };
    if (email === 'hello@thelifecoachingcafe.com') {
        mockUser.role = 'admin';
        mockUser.name = 'Admin User';
    }
    // setUser(mockUser); // This would be incorrect as setUser expects FirebaseUser | null
    try {
      localStorage.setItem('coachconnect-user', JSON.stringify(mockUser));
    } catch (error) {
      console.error("Failed to save mock user to localStorage:", error);
    }
    // To make this work with Firebase, you'd call something like:
    // import { signInWithEmailAndPassword } from 'firebase/auth';
    // signInWithEmailAndPassword(auth, email, password_from_form)
    //   .then(userCredential => { /* onAuthStateChanged will handle setUser */ })
    //   .catch(error => console.error("Firebase login error:", error));
  };

  const logout = () => {
    console.warn("AuthContext: Mock logout function called. For Firebase auth, this needs to be updated to use Firebase SDK (e.g., signOut).");
    // To make this work with Firebase, you'd call something like:
    // import { signOut } from 'firebase/auth';
    // signOut(auth)
    //   .then(() => { /* onAuthStateChanged will handle setUser(null) */ })
    //   .catch(error => console.error("Firebase logout error:", error));
    // For now, just clearing the mock user from localStorage
    try {
      localStorage.removeItem('coachconnect-user');
    } catch (error) {
      console.error("Failed to remove mock user from localStorage:", error);
    }
    // Calling Firebase signOut will trigger onAuthStateChanged which sets user to null.
    // auth.signOut(); // If you want to trigger actual Firebase logout
  };


  const providerValue = { user, login, logout, loading };

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
