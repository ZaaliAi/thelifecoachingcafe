
// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration (directly provided)
const firebaseConfig = {
  apiKey: "AIzaSyCF3xIso6izSPcnrUX3J1bD2xLalcEpASc",
  authDomain: "coachconnect-897af.firebaseapp.com",
  projectId: "coachconnect-897af",
  storageBucket: "coachconnect-897af.firebasestorage.app",
  messagingSenderId: "881397502693",
  appId: "1:881397502693:web:42db1643b43d027e283a0c"
};

// Log to confirm the source of the config
console.log("--- Firebase Configuration: Using directly embedded config ---");
console.log("Project ID:", firebaseConfig.projectId);
console.log("API Key:", firebaseConfig.apiKey ? "Present" : "MISSING");


let app: FirebaseApp;

if (!getApps().length) {
  try {
    app = initializeApp(firebaseConfig);
    console.log("Firebase App initialized successfully with embedded config.");
  } catch (error) {
    console.error("Firebase initializeApp FAILED even with embedded config. This could indicate an issue with the Firebase SDKs or the provided config values themselves are invalid for your project.", error);
    console.error("Firebase config that was attempted:", firebaseConfig);
    throw error; // Re-throw the original Firebase error
  }
} else {
  app = getApps()[0];
  console.log("Firebase App already initialized (this is normal with HMR).");
}

const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { db, storage, auth, app };
