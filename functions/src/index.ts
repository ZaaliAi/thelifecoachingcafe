import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
// For v6 functions, HttpsError and CallableRequest might be imported from v2/https if using Gen 2 explicitly
// For v4/v5, HttpsError is usually functions.https.HttpsError and request structure is different.
// Given the build errors, let's assume a more v2-like structure is now expected for onCall by the SDK version installed.
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https"; 

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const deleteUserAccount = functions.https.onCall(async (request: CallableRequest<any>) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  const userId = request.auth.uid;
  const firestore = admin.firestore();

  functions.logger.log(`Attempting to delete account for user: ${userId}`);

  try {
    await admin.auth().deleteUser(userId);
    functions.logger.log(`Successfully deleted user ${userId} from Firebase Auth.`);

    const userProfileRef = firestore.collection("userProfiles").doc(userId);
    const favoritesRef = firestore.collection("favorites").doc(userId);
    const batch = firestore.batch();
    batch.delete(userProfileRef);
    batch.delete(favoritesRef);
    await batch.commit();
    functions.logger.log(
      `Successfully deleted user profile and favorites for ${userId} from Firestore.`
    );

    const conversationsQuery = firestore
      .collection("conversations")
      .where("members", "array-contains", userId);
    const conversationsSnapshot = await conversationsQuery.get();

    if (!conversationsSnapshot.empty) {
      const conversationBatch = firestore.batch();
      conversationsSnapshot.docs.forEach((doc) => {
        functions.logger.log(`Removing user ${userId} from conversation ${doc.id}`);
        conversationBatch.update(doc.ref, {
          members: admin.firestore.FieldValue.arrayRemove(userId),
        });
      });
      await conversationBatch.commit();
      functions.logger.log(
        `Successfully removed user ${userId} from applicable conversations.`
      );
    } else {
      functions.logger.log(`No conversations found containing user ${userId}.`);
    }

    return {
      message: `Successfully deleted account and all associated data for user ${userId}.`,
    };
  } catch (error: any) {
    functions.logger.error(
      `Error deleting user account for ${userId}:`,
      error
    );
    
    let errorCode: functions.https.FunctionsErrorCode = "internal"; // functions.https.FunctionsErrorCode for older versions
    let errorMessage = "An unknown error occurred while deleting the account.";

    // Check if it's an HttpsError instance (from firebase-functions/v2/https or older functions.https.HttpsError)
    if (error instanceof HttpsError) {
        throw error; // Re-throw if it's already the correct type
    }
    // Fallback for other error types
    if (error.code === "auth/user-not-found") {
      // This specific string 'auth/user-not-found' is from Firebase Auth SDK, not an HttpsErrorCode
      // We should map it to an HttpsErrorCode
      errorCode = "not-found"; 
      errorMessage = "User not found in Firebase Authentication. Data cleanup might be partially complete or failed."
    } else if (error.message) {
        errorMessage = error.message;
    }

    throw new HttpsError(errorCode as any, errorMessage, error.details); // Cast errorCode if necessary
  }
});

export * from "./stripe";
export * from "./contact";
