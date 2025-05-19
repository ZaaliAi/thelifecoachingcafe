// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore"; // Import connectFirestoreEmulator
import { getStorage } from "firebase/storage";
import { getAuth, connectAuthEmulator } from "firebase/auth"; // Import connectAuthEmulator

// Your web app's Firebase configuration (using environment variables)
const firebaseConfig = {
  apiKey: "AIzaSyCF3xIso6izSPcnrUX3J1bD2xLalcEpASc",
  authDomain: "coachconnect-897af.firebaseapp.com",
  projectId: "coachconnect-897af",
  storageBucket: "coachconnect-897af.firebasestorage.app",
  messagingSenderId: "881397502693",
  appId: "1:881397502693:web:42db1643b43d027e283a0c"
};

// Log to confirm the source of the config
console.log("--- Firebase Configuration: Using environment variables ---");
console.log("Project ID:", firebaseConfig.projectId);
console.log("API Key:", firebaseConfig.apiKey ? "Present" : "MISSING - Check NEXT_PUBLIC_FIREBASE_API_KEY in .env.local");


let app: FirebaseApp;

// Check if Firebase app is already initialized
if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log("Firebase App initialized successfully with embedded config.");
  } catch (error) {
    console.error("Firebase initializeApp FAILED even with embedded config.", error);
    console.error("Firebase config that was attempted:", firebaseConfig);
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
if (process.env.NODE_ENV === 'development') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8081); // Connect to Firestore emulator
    console.log("Connected to Firestore emulator.");
    // Assuming Auth emulator runs on default port 9099 based on common setups
    connectAuthEmulator(auth, 'http://localhost:9099'); // Connect to Auth emulator
    console.log("Connected to Auth emulator.");
    // If you are using other emulators (like Functions on 5001), add them here:
    // connectFunctionsEmulator(app, 'localhost', 5001);
  } catch (e) {
    console.error("Failed to connect to Firebase emulators:", e);
  }
}


export { db, storage, auth, app, firebaseConfig }; // Added firebaseConfig to exports
