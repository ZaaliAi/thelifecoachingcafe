// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"; // Import connectFirestoreEmulator
import { getStorage } from "firebase/storage";
import { getAuth, connectAuthEmulator } from "firebase/auth"; // Import connectAuthEmulator

// Your web app's Firebase configuration (using environment variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Log to confirm the source of the config
console.log("--- Firebase Configuration: Using environment variables ---");
console.log("Project ID:", firebaseConfig.projectId);
console.log("API Key:", firebaseConfig.apiKey ? "Present" : "MISSING - Check NEXT_PUBLIC_FIREBASE_API_KEY");


let app: FirebaseApp;

// Check if Firebase app is already initialized
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log("Firebase App initialized successfully.");
  } catch (error) {
    console.error("Firebase initializeApp FAILED.", error);
    console.error("Firebase config that was attempted:", firebaseConfig);
    if (!firebaseConfig.apiKey) {
      console.error("REASON: Missing API Key. Ensure NEXT_PUBLIC_FIREBASE_API_KEY is set in your environment.");
    }
    if (!firebaseConfig.projectId) {
      console.error("REASON: Missing Project ID. Ensure NEXT_PUBLIC_FIREBASE_PROJECT_ID is set in your environment.");
    }
    throw error;
  }
} else {
  app = getApps()[0];
  console.log("Firebase App already initialized (this is normal with HMR).");
}

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Connect to Firebase Emulators in development
/*
if (process.env.NODE_ENV === 'development') {
  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8094); // Connect to Firestore emulator on new port using 127.0.0.1
    console.log("Attempting to connect to Firestore emulator on 127.0.0.1:8094.");
    connectAuthEmulator(auth, 'http://127.0.0.1:9112'); // Connect to Auth emulator on new port using 127.0.0.1
    console.log("Attempting to connect to Auth emulator on http://127.0.0.1:9112.");
  } catch (e) {
    console.error("Failed to connect to Firebase emulators:", e);
  }
}
*/

export { db, storage, auth, app, firebaseConfig }; // Added firebaseConfig to exports
