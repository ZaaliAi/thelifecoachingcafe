
"use client";

import type { User, UserRole, FirestoreUserProfile } from '@/types';
import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { auth, db } from './firebase'; 
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
  signup: (name: string, email: string, pass: string, role: UserRole) => Promise<UserRole | null>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SIGNUP_ROLE_KEY = 'coachconnect-signup-role';
const PENDING_COACH_PROFILE_KEY = 'coachconnect-pending-coach-profile';


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    console.log("AuthProvider: useEffect for onAuthStateChanged mounting.");
    setLoading(true);
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log("AuthProvider: onAuthStateChanged triggered. Firebase user:", firebaseUser?.email);
      if (firebaseUser) {
        let determinedRole: UserRole = 'user'; 
        let userName = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
        let profileNeedsCreationDueToSignup = false;
        let isNewFirebaseUser = firebaseUser.metadata.creationTime === firebaseUser.metadata.lastSignInTime;

        console.log(`AuthProvider: User ${firebaseUser.email}, isNewFirebaseUser: ${isNewFirebaseUser}`);

        if (firebaseUser.email === 'hello@thelifecoachingcafe.com') {
          determinedRole = 'admin';
          userName = 'Admin User';
          console.log(`AuthProvider: Admin user identified: ${userName}`);
        } else {
          const signupRoleAttempt = localStorage.getItem(SIGNUP_ROLE_KEY) as UserRole | null;
          if (signupRoleAttempt && isNewFirebaseUser) { // Only apply signup role if it's a truly new user session for this account
            determinedRole = signupRoleAttempt;
            profileNeedsCreationDueToSignup = true; 
            console.log(`AuthProvider: Role from signup localStorage: ${determinedRole}`);
          } else {
            const existingProfile = await getUserProfile(firebaseUser.uid);
            if (existingProfile) {
              determinedRole = existingProfile.role;
              userName = existingProfile.name || userName;
              console.log(`AuthProvider: Role from existing Firestore profile: ${determinedRole}`);
            } else {
              // User exists in Auth but not Firestore. This is a fresh login for a user
              // whose profile wasn't created (e.g. direct Firebase console creation or previous error)
              // Default to 'user' and attempt profile creation.
              profileNeedsCreationDueToSignup = true; 
              determinedRole = 'user'; // Sensible default
              console.log(`AuthProvider: No Firestore profile, will create as '${determinedRole}'.`);
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
        console.log("AuthProvider: App user context set:", appUser);

        // Ensure profile exists in Firestore & role is correct
        try {
          const userProfileRef = doc(db, "users", firebaseUser.uid);
          const userProfileSnap = await getDoc(userProfileRef);

          const dataForFirestore: Partial<FirestoreUserProfile> = {
            name: userName,
            email: firebaseUser.email!,
            role: determinedRole, // This is the critical part
            profileImageUrl: firebaseUser.photoURL || null, // Explicitly null if undefined for Firestore
            // Only set subscriptionTier if it's relevant (e.g., for coaches, or if a default should apply to all new users)
          };

          if (determinedRole === 'coach') {
            dataForFirestore.subscriptionTier = 'free'; // Default for new coaches
          }


          if (!userProfileSnap.exists() || profileNeedsCreationDueToSignup) {
            console.log(`AuthProvider: Creating/Updating Firestore profile for ${firebaseUser.email} with role ${determinedRole}. Data:`, dataForFirestore);
            await setUserProfile(firebaseUser.uid, dataForFirestore); // setUserProfile handles createdAt/updatedAt
            console.log(`AuthProvider: User profile CREATED/FORCED in Firestore for ${firebaseUser.email} with role ${determinedRole}`);
            if (profileNeedsCreationDueToSignup && localStorage.getItem(SIGNUP_ROLE_KEY)) {
              localStorage.removeItem(SIGNUP_ROLE_KEY);
              console.log("AuthProvider: Removed SIGNUP_ROLE_KEY from localStorage.");
            }
          } else {
            const currentFirestoreData = userProfileSnap.data();
            const currentFirestoreRole = currentFirestoreData?.role;
            // If admin logs in and their role isn't admin in DB, or if a signup role was missed
            if ((determinedRole === 'admin' && currentFirestoreRole !== 'admin') || 
                (localStorage.getItem(SIGNUP_ROLE_KEY) && currentFirestoreRole !== determinedRole)) {
               await updateDoc(userProfileRef, { 
                 role: determinedRole, 
                 name: userName, // Also ensure name is updated if it was from displayName
                 updatedAt: serverTimestamp() 
                });
               console.log(`AuthProvider: User role/name UPDATED in Firestore for ${firebaseUser.email} to ${determinedRole}.`);
               if (localStorage.getItem(SIGNUP_ROLE_KEY)) {
                 localStorage.removeItem(SIGNUP_ROLE_KEY);
                 console.log("AuthProvider: Removed SIGNUP_ROLE_KEY from localStorage after role update.");
               }
            } else {
              console.log(`AuthProvider: Firestore profile for ${firebaseUser.email} already exists with role ${currentFirestoreRole}. No forced update.`);
            }
          }
        } catch (profileError) {
          console.error("AuthProvider: Error ensuring user profile/role in Firestore:", profileError);
        }

      } else {
        setUser(null);
        console.log("AuthProvider: No Firebase user, app user set to null.");
      }
      setLoading(false);
      console.log("AuthProvider: Loading state set to false.");
    });

    return () => {
      console.log("AuthProvider: useEffect for onAuthStateChanged unmounting.");
      unsubscribe();
    }
  }, []);

  const loginUser = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged will handle setting the user state and Firestore profile.
    } catch (error: any) {
      setLoading(false); // Ensure loading is false on error
      console.error("Firebase login error:", error);
      throw error; 
    }
  };

  const signupUser = async (name: string, email: string, pass: string, role: UserRole): Promise<UserRole | null> => {
    setLoading(true);
    console.log(`signupUser: Attempting to sign up ${email} as ${role}`);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      console.log(`signupUser: Firebase Auth user created: ${userCredential.user.uid}`);
      await updateProfile(userCredential.user, { displayName: name });
      console.log(`signupUser: Firebase profile updated with displayName: ${name}`);

      localStorage.setItem(SIGNUP_ROLE_KEY, role);
      console.log(`signupUser: Set SIGNUP_ROLE_KEY to ${role}`);
      if (role === 'coach') {
        localStorage.setItem(PENDING_COACH_PROFILE_KEY, JSON.stringify({ name, email }));
        console.log(`signupUser: Set PENDING_COACH_PROFILE_KEY for ${email}`);
      }
      // onAuthStateChanged will handle setting the user state & Firestore profile creation.
      // setLoading(false) will be handled by onAuthStateChanged.
      return role; 
    } catch (error: any) {
      setLoading(false); 
      console.error("Firebase signup error:", error.code, error.message);
      localStorage.removeItem(SIGNUP_ROLE_KEY); 
      localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
      throw error; 
    }
  };

  const logoutUser = async () => {
    setLoading(true);
    console.log("logoutUser: Attempting to sign out.");
    try {
      await signOut(auth);
      setUser(null); 
      localStorage.removeItem(SIGNUP_ROLE_KEY); 
      localStorage.removeItem(PENDING_COACH_PROFILE_KEY);
      console.log("logoutUser: Cleared localStorage keys and set user to null.");
      // router.push('/'); // Let pages handle redirection if needed, or keep global redirect
    } catch (error: any) {
      console.error("Firebase logout error:", error);
      throw error;
    } finally {
      setLoading(false);
      console.log("logoutUser: Loading state set to false.");
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
