import admin from 'firebase-admin';

// Log at the very top of the file to confirm it's being executed.
console.log("Loading module: @/lib/firebaseAdmin.ts");

// Define exported variables.
let adminAuth: admin.auth.Auth | null = null;
let adminFirestore: admin.firestore.Firestore | null = null;
const FirebaseFirestoreNamespace = admin.firestore;

// Check if the app is already initialized.
if (!admin.apps.length) {
  console.log("Firebase Admin SDK has not been initialized yet. Proceeding with initialization...");
  
  const serviceAccountString = process.env.FIREBASE_ADMIN_SDK_CONFIG;

  if (!serviceAccountString) {
    // This is a critical error, but we won't throw here to prevent the server from crashing on import.
    // The functions that rely on the SDK will fail gracefully instead.
    console.error('CRITICAL ERROR: The FIREBASE_ADMIN_SDK_CONFIG environment variable is not set. The application will not be able to connect to Firebase services.');
  } else {
    try {
      const serviceAccount = JSON.parse(serviceAccountString);
      
      // Initialize the app with the service account.
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      
      console.log('Firebase Admin SDK initialized successfully.');
      // Assign the services now that initialization is complete.
      adminAuth = admin.auth();
      adminFirestore = admin.firestore();

    } catch (error: any) {
      // Log the specific error that occurred during initialization.
      console.error('CRITICAL ERROR: Failed to initialize Firebase Admin SDK. Please check the validity of the FIREBASE_ADMIN_SDK_CONFIG environment variable.');
      console.error('Initialization error details:', error.message);
    }
  }
} else {
  console.log('Firebase Admin SDK was already initialized. Reusing existing instance.');
  // Assign the services from the existing app.
  adminAuth = admin.auth();
  adminFirestore = admin.firestore();
}

// Export the initialized (or null) services.
export { admin, adminAuth, adminFirestore, FirebaseFirestoreNamespace };
