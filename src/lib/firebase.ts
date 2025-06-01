// src/lib/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFunctions, type Functions } from 'firebase/functions'; // Import getFunctions

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // Optional
};

// Initialize Firebase
let firebaseApp: FirebaseApp; // Changed 'app' to 'firebaseApp' for clarity and consistency
let authInstance: Auth;
let dbInstance: Firestore;
let storageInstance: FirebaseStorage;
let functionsInstance: Functions; // Added for Firebase Functions

if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApp(); // Use getApp() if already initialized
}

authInstance = getAuth(firebaseApp);
dbInstance = getFirestore(firebaseApp);
storageInstance = getStorage(firebaseApp);
functionsInstance = getFunctions(firebaseApp); // Initialize Firebase Functions

export { 
  firebaseApp, // Export as firebaseApp
  authInstance as auth, // Exporting as 'auth' for brevity if preferred, or 'authInstance'
  dbInstance as db,     // Exporting as 'db'
  storageInstance as storage, // Exporting as 'storage'
  functionsInstance as functions // Export Firebase Functions
};
