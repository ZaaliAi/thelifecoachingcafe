
"use client";

import type { User, UserRole } from '@/types';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { auth, db } from './firebase'; // Import Firebase auth and db instance
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  updateProfile,
  type User as FirebaseUser 
} from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { setUserProfile, getUserProfile } from './firestore';


interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  signup: (name: string, email: string, pass: string, role: UserRole) => Promise<UserRole | null>; // Return role or null on error
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper keys for localStorage
const SIGNUP_ROLE_KEY = 'coachconnect-signup-role';
const PENDING_COACH_PROFILE_KEY = 'coachconnect-pending-coach-profile';


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        let determinedRole: UserRole = 'user'; 
        let userName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
        let profileNeedsCreationDueToSignup = false;

        if (firebaseUser.email === 'hello@thelifecoachingcafe.com') {
          determinedRole = 'admin';
          userName = 'Admin User';
        } else {
          const signupRoleAttempt = localStorage.getItem(SIGNUP_ROLE_KEY) as UserRole | null;
          if (signupRoleAttempt) {
            determinedRole = signupRoleAttempt;
            profileNeedsCreationDueToSignup = true; // Mark that this role came from a fresh signup
          } else {
            const existingProfile = await getUserProfile(firebaseUser.uid);
            if (existingProfile) {
              determinedRole = existingProfile.role;
              userName = existingProfile.name || userName;
            } else {
              // User exists in Auth but not Firestore. This is a fresh login for a user
              // whose profile wasn't created (e.g. direct Firebase console creation or previous error)
              // Default to 'user' and attempt profile creation.
              profileNeedsCreationDueToSignup = true; 
            }
          }
        }
        
        const appUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          role: determinedRole,
          name: userName,
          profileImageUrl: firebaseUser.photoURL || undefined,
        };
        setUser(appUser);

        // Ensure profile exists in Firestore & role is correct
        try {
          const userProfileRef = doc(db, "users", firebaseUser.uid);
          const userProfileSnap = await getDoc(userProfileRef);

          if (!userProfileSnap.exists()) {
            await setUserProfile(firebaseUser.uid, {
              name: userName,
              email: firebaseUser.email!,
              role: determinedRole,
              // createdAt will be set by setUserProfile
            });
            console.log(`User profile CREATED in Firestore for ${firebaseUser.email} with role ${determinedRole}`);
            // If profile was created because of a signup role, clear the localStorage key
            if (profileNeedsCreationDueToSignup && localStorage.getItem(SIGNUP_ROLE_KEY)) {
              localStorage.removeItem(SIGNUP_ROLE_KEY);
            }
          } else {
            const currentFirestoreRole = userProfileSnap.data().role;
            // If it was a signup flow and role in DB is different, or if user is admin and DB role isn't
            if ((profileNeedsCreationDueToSignup && localStorage.getItem(SIGNUP_ROLE_KEY) && currentFirestoreRole !== determinedRole) || 
                (determinedRole === 'admin' && currentFirestoreRole !== 'admin')) {
               await updateDoc(userProfileRef, { 
                 role: determinedRole, 
                 name: userName, // Also ensure name is updated if it was from displayName
                 updatedAt: serverTimestamp() 
                });
               console.log(`User role/name UPDATED in Firestore for ${firebaseUser.email} to ${determinedRole}.`);
               if (localStorage.getItem(SIGNUP_ROLE_KEY)) {
                 localStorage.removeItem(SIGNUP_ROLE_KEY);
               }
            }
          }
        } catch (profileError) {
          console.error("Error ensuring user profile/role in Firestore:", profileError);
        }

      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginUser = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle setting the user state.
    } catch (error: any) {
      setLoading(false);
      console.error("Firebase login error:", error);
      throw error; 
    }
  };

  const signupUser = async (name: string, email: string, pass: string, role: UserRole): Promise<UserRole | null> => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCredential.user, { displayName: name });

      localStorage.setItem(SIGNUP_ROLE_KEY, role);
      if (role === 'coach') {
        localStorage.setItem(PENDING_COACH_PROFILE_KEY, JSON.stringify({ name, email }));
      }
      // onAuthStateChanged will handle setting the user state & Firestore profile creation.
      // setLoading(false) will be handled by onAuthStateChanged.
      return role; // Return the role for immediate redirection by the caller
    } catch (error: any) {
      setLoading(false);
      console.error("Firebase signup error:", error);
      localStorage.removeItem(SIGNUP_ROLE_KEY); // Clean up if signup fails
      localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
      throw error; 
    }
  };

  const logoutUser = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setUser(null); // Explicitly set user to null immediately
      localStorage.removeItem(SIGNUP_ROLE_KEY); // Clean up just in case
      localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
      router.push('/'); 
    } catch (error: any) {
      console.error("Firebase logout error:", error);
      throw error;
    } finally {
      setLoading(false);
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
