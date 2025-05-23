import admin from 'firebase-admin';

console.log("Attempting to initialize Firebase Admin SDK...");

const serviceAccountString = process.env.FIREBASE_ADMIN_SDK_CONFIG;

if (!serviceAccountString) {
  console.error('FIREBASE_ADMIN_SDK_CONFIG environment variable is not set.');
  throw new Error('FIREBASE_ADMIN_SDK_CONFIG environment variable is not set.');
}

console.log("Service account string (first 50 chars):", serviceAccountString.substring(0, 50));

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountString);
  console.log("Parsed service account credentials successfully.");
} catch (e: any) {
  console.error("Error parsing FIREBASE_ADMIN_SDK_CONFIG JSON:", e.message);
  // Intentionally removed the problematic console.error line here
  throw new Error("Error parsing FIREBASE_ADMIN_SDK_CONFIG JSON: " + e.message);
}

if (!admin.apps.length) {
  try {
    console.log("Attempting admin.initializeApp with the parsed serviceAccount object...");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error: any) {
    console.error('Error during admin.initializeApp:', error.stack);
    console.error('Failed serviceAccount object for initializeApp:', JSON.stringify(serviceAccount)); // Log the object that failed
    throw new Error('Error initializing Firebase Admin SDK: ' + error.message);
  }
} else {
  console.log('Firebase Admin SDK already initialized.');
}

const adminAuth = admin.auth();
const adminFirestore = admin.firestore();

export { admin, adminAuth, adminFirestore };
