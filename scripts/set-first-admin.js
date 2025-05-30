// Import the Firebase Admin SDK
const admin = require('firebase-admin');

// --- CONFIGURATION ---
// IMPORTANT: Path to your service account key JSON file.
// Set the ADMIN_SDK_PATH environment variable, or update the fallback path.
const serviceAccountPath = process.env.ADMIN_SDK_PATH || './replace-with-path-to-your-new-key.json';

// IMPORTANT: Replace this with the email address or UID of the user you want to make an admin
const userIdentifier = 'hello@thelifecoachingcafe.com'; // <--- Email UPDATED
// --- END CONFIGURATION ---

let serviceAccount;
try {
  serviceAccount = require(serviceAccountPath);
} catch (error) {
  console.error(`Failed to load service account key from path: ${serviceAccountPath}`);
  console.error('Please ensure the path is correct or the ADMIN_SDK_PATH environment variable is set.');
  console.error(error);
  process.exit(1);
}

// Initialize the Firebase Admin SDK
try {
  if (!admin.apps.length) { // Check if an app hasn't already been initialized
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin SDK initialized.");
  } else {
    console.log("Firebase Admin SDK already initialized (likely by another part of the process or a previous run).");
  }
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error);
  process.exit(1);
}


async function setAdmin() {
  if (!admin.apps.length) {
    console.error("Firebase Admin SDK is not initialized. Exiting.");
    return;
  }
  try {
    let uidToSet;
    // If userIdentifier is an email, get the UID
    if (userIdentifier.includes('@')) {
      const userRecord = await admin.auth().getUserByEmail(userIdentifier);
      uidToSet = userRecord.uid;
      console.log(`Found user by email: ${userIdentifier}, UID: ${uidToSet}`);
    } else {
      uidToSet = userIdentifier; // Assume it's a UID
      console.log(`Using provided UID: ${uidToSet}`);
    }

    // Set the custom claim
    await admin.auth().setCustomUserClaims(uidToSet, { admin: true });
    console.log(`Successfully set 'admin: true' custom claim for user: ${uidToSet}`);

    // Verify the claim (optional, but good for confirmation)
    const updatedUser = await admin.auth().getUser(uidToSet);
    console.log('Updated user claims:', updatedUser.customClaims);
    if (updatedUser.customClaims && updatedUser.customClaims.admin === true) {
      console.log(`Verification successful: User ${uidToSet} is now an admin.`);
    } else {
      console.warn(`Verification failed or claim not immediately available for user ${uidToSet}. It might take a moment for claims to propagate. Please check Firebase console.`);
    }

  } catch (error) {
    console.error('Error setting custom claim:', error);
    if (error.code === 'auth/user-not-found') {
        console.error(`Could not find user with identifier: ${userIdentifier}. Please ensure the email or UID is correct and the user exists in Firebase Authentication.`);
    } else if (error.message.includes("serviceAccount") || (error.message.includes("Failed to load service account key"))) { // Adjusted error check
        console.error("Likely an issue with your service account key. Please ensure the path is correct and the JSON file is valid.");
    }
  } finally {
    // Important: Do not delete the app if other operations might still need it,
    // especially if running in an environment where the SDK is initialized once.
    // For a standalone script, you might consider admin.app().delete() if you are done.
    // However, for safety and to avoid issues if this script is run multiple times or in a shared context,
    // we'll leave it without an explicit delete here.
  }
}

// Check if the script is run directly
if (require.main === module) {
    setAdmin();
} else {
    // This allows the function to be imported and called elsewhere if needed,
    // though it's primarily designed as a standalone script.
    console.log("Script loaded as a module. Call setAdmin() to execute.");
}
