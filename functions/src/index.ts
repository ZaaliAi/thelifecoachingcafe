import * as functions from 'firebase-functions';
import { onDocumentCreated, onDocumentWritten, DocumentSnapshot, Change, FirestoreEvent, QueryDocumentSnapshot } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { HttpsError, type CallableRequest } from 'firebase-functions/v2/https';

// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const firestore = admin.firestore();

// --- Suspend User Function ---
/**
 * Callable Cloud Function to suspend a user account.
 * Disables the user in Firebase Authentication and updates their Firestore profile status.
 *
 * @param {CallableRequest<{ userId: string }>} request - The request object.
 * @returns {Promise<{ message: string }>}
 */
export const suspendUser = functions.https.onCall(async (request: CallableRequest<{ userId: string }>) => {
    // 1. Authenticate and Authorize (important for admin actions)
    // Ensure an authenticated admin user is making this request.
    // This example assumes you have a way to identify admins, e.g., via custom claims.
    if (!request.auth || !request.auth.uid) {
        throw new HttpsError('unauthenticated', 'The request is not authenticated.');
    }

    const callerUid = request.auth.uid;
    const callerUser = await admin.auth().getUser(callerUid);

    // Assuming you have a custom claim 'admin' set to true for admin users
    if (!callerUser.customClaims || !callerUser.customClaims.admin) {
        throw new HttpsError('permission-denied', 'Only admin users can suspend accounts.');
    }

    const { userId } = request.data; // Get the userId to suspend from the request data

    if (!userId) {
        throw new HttpsError('invalid-argument', 'User ID is required to suspend an account.');
    }

    functions.logger.log(`Attempting to suspend user: ${userId} by admin: ${callerUid}`);

    try {
        // 2. Disable user in Firebase Authentication
        await admin.auth().updateUser(userId, { disabled: true });
        functions.logger.log(`Successfully disabled user ${userId} in Firebase Auth.`);

        // 3. Update Firestore profile status
        const userProfileRef = firestore.collection('userProfiles').doc(userId);
        await userProfileRef.update({ status: 'suspended' });
        functions.logger.log(`Successfully updated Firestore status to 'suspended' for user ${userId}.`);

        return { message: `User ${userId} has been suspended.` };
    } catch (error: any) {
        functions.logger.error(`Error suspending user ${userId}:`, error);

        if (error.code === 'auth/user-not-found') {
            throw new HttpsError('not-found', 'The target user was not found in Firebase Authentication.');
        } else if (error.code === 'auth/invalid-uid') {
             throw new HttpsError('invalid-argument', 'The provided user ID is invalid.');
        }
        throw new HttpsError('internal', `Failed to suspend user: ${error.message || 'An unknown error occurred.'}`);
    }
});

// --- Unsuspend User Function ---
/**
 * Callable Cloud Function to unsuspend a user account.
 * Enables the user in Firebase Authentication and updates their Firestore profile status.
 *
 * @param {CallableRequest<{ userId: string }>} request - The request object.
 * @returns {Promise<{ message: string }>}
 */
export const unsuspendUser = functions.https.onCall(async (request: CallableRequest<{ userId: string }>) => {
    // 1. Authenticate and Authorize (important for admin actions)
    // Ensure an authenticated admin user is making this request.
    if (!request.auth || !request.auth.uid) {
        throw new HttpsError('unauthenticated', 'The request is not authenticated.');
    }

    const callerUid = request.auth.uid;
    const callerUser = await admin.auth().getUser(callerUid);

    // Assuming you have a custom claim 'admin' set to true for admin users
    if (!callerUser.customClaims || !callerUser.customClaims.admin) {
        throw new HttpsError('permission-denied', 'Only admin users can unsuspend accounts.');
    }

    const { userId } = request.data; // Get the userId to unsuspend from the request data

    if (!userId) {
        throw new HttpsError('invalid-argument', 'User ID is required to unsuspend an account.');
    }

    functions.logger.log(`Attempting to unsuspend user: ${userId} by admin: ${callerUid}`);

    try {
        // 2. Enable user in Firebase Authentication
        await admin.auth().updateUser(userId, { disabled: false });
        functions.logger.log(`Successfully enabled user ${userId} in Firebase Auth.`);

        // 3. Update Firestore profile status
        const userProfileRef = firestore.collection('userProfiles').doc(userId);
        await userProfileRef.update({ status: 'active' }); // Or 'approved' if that's your active status
        functions.logger.log(`Successfully updated Firestore status to 'active' for user ${userId}.`);

        return { message: `User ${userId} has been unsuspended.` };
    } catch (error: any) {
        functions.logger.error(`Error unsuspending user ${userId}:`, error);

        if (error.code === 'auth/user-not-found') {
            throw new HttpsError('not-found', 'The target user was not found in Firebase Authentication.');
        } else if (error.code === 'auth/invalid-uid') {
             throw new HttpsError('invalid-argument', 'The provided user ID is invalid.');
        }
        throw new HttpsError('internal', `Failed to unsuspend user: ${error.message || 'An unknown error occurred.'}`);
    }
});

---

## Existing Functions

```typescript
/**
 * Firestore Trigger (2nd Gen) to send a new message notification email.
 * This function is triggered whenever a new document is created in the 'messages' collection.
 *
 * It performs the following operations:
 * 1. Retrieves message data and recipient information.
 * 2. Fetches the recipient's email and preferred name from their user profile.
 * 3. Constructs and sends an email notification using Nodemailer and SMTP.
 *
 * @param {FirestoreEvent<QueryDocumentSnapshot | undefined>} event - The event object containing
 * the new document snapshot and path parameters.
 */
export const sendNewMessageNotification = onDocumentCreated(
  'messages/{messageId}', // Specifies the Firestore path to listen for new document creations
  async (event: FirestoreEvent<QueryDocumentSnapshot | undefined>) => {
    // Ensure event data exists (for onCreate, event.data will be the new snapshot).
    const snap = event.data;
    if (!snap) {
      functions.logger.log('No data associated with the message creation event for event ID:', event.id);
      return; // Exit if no snapshot data
    }

    const messageData = snap.data(); // Get the actual data from the document snapshot
    const messageId = snap.id; // Get the ID of the newly created message document

    // Log and exit if message data is unexpectedly empty.
    if (!messageData) {
      functions.logger.log('Message data is empty for messageId: ' + messageId);
      return;
    }

    const senderName = messageData.senderName || 'A user'; // Get sender's name, with a fallback
    const recipientId = messageData.recipientId; // Get the ID of the message recipient
    let recipientNameForEmail = messageData.recipientName || 'User'; // Initial fallback for recipient's name

    // Log and exit if recipient ID is missing.
    if (!recipientId) {
      functions.logger.error('Recipient ID is missing in the message data for messageId: ' + messageId, messageData);
      return;
    }

    let recipientEmail: string | undefined;

    try {
      // Fetch the recipient's user profile to get their email and preferred name.
      const userProfileDoc = await firestore.collection('userProfiles').doc(recipientId).get();
      if (userProfileDoc.exists) {
        const userProfileData = userProfileDoc.data();
        if (userProfileData) {
            recipientEmail = userProfileData.email;
            // Prioritize 'name' from profile, then 'displayName', then initial fallback.
            recipientNameForEmail = userProfileData.name || userProfileData.displayName || recipientNameForEmail;
        } else {
            functions.logger.error('User profile data is undefined for recipient ID: ' + recipientId);
            return; // Exit if profile data is unexpectedly empty
        }
      } else {
        functions.logger.error('Recipient profile not found for ID: ' + recipientId);
        return; // Exit if recipient profile doesn't exist
      }
    } catch (error) {
      functions.logger.error('Error fetching recipient profile for ID ' + recipientId + ':', error);
      return; // Exit on error during profile fetch
    }

    // Log and exit if recipient email could not be determined.
    if (!recipientEmail) {
      functions.logger.error('Email not found for recipient ID: ' + recipientId + '. Cannot send notification.');
      return;
    }

    // --- SMTP Configuration ---
    // IMPORTANT: These environment variables MUST be set in your Firebase project
    // using the Firebase CLI. Example:
    // firebase functions:config:set smtp.host="your.smtp.host" smtp.port="587" smtp.secure="true" smtp.user="your@email.com" smtp.pass="your_password"
    // After setting, re-deploy your functions for changes to take effect.
    const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
        secure: process.env.SMTP_SECURE === 'true', // Convert string 'true'/'false' to boolean
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    };

    // Validate SMTP configuration.
    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      functions.logger.error('SMTP configuration (SMTP_HOST, SMTP_USER, SMTP_PASS) is missing or incomplete in environment variables. Cannot send email.');
      return;
    }

    // Create a Nodemailer transporter using the SMTP configuration.
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });

    // Define the email options, including sender, recipient, subject, and body.
    const mailOptions = {
      from: smtpConfig.user, // Sender email address
      to: recipientEmail, // Recipient email address
      subject: 'You have received a new message from ' + senderName,
      // Email body using a template literal for easy multi-line strings and variable interpolation.
      text: `Hi ${recipientNameForEmail},

You have a new message from ${senderName}.
Log in to view the full message on The Life Coaching Cafe.

Thanks,
The Life Coaching Cafe Team`,
    };

    try {
      // Send the email using the configured transporter.
      await transporter.sendMail(mailOptions);
      functions.logger.log('New message notification email sent to ' + recipientEmail + ' for message ' + messageId);
    } catch (error) {
      // Log any errors that occur during email sending.
      functions.logger.error('Error sending new message notification email via nodemailer for messageId: ' + messageId, error);
    }
});

/**
 * Firestore Trigger (2nd Gen) to send an email notification when a user's profile status changes to 'approved'.
 * This function is triggered whenever a document in the 'userProfiles' collection is written (created, updated, or deleted).
 *
 * It checks if the 'status' field of the user profile has just changed to 'approved'
 * and then sends an approval email.
 *
 * @param {FirestoreEvent<Change<DocumentSnapshot> | undefined, { userId: string }>} event - The event object containing
 * the before and after document snapshots and path parameters.
 */
export const onUserApproved = onDocumentWritten(
  'userProfiles/{userId}', // Specifies the Firestore path to listen for document writes
  async (event: FirestoreEvent<Change<DocumentSnapshot> | undefined, { userId: string }>) => { // Corrected event type
    // Ensure event data exists (for onDocumentWritten, event.data will be a Change object).
    if (!event || !event.data) {
      functions.logger.log('No data associated with the user approval event:', event.id);
      return; // Exit if no event data
    }

    // For onDocumentWritten, event.data.before and event.data.after are QueryDocumentSnapshot | undefined
    // We cast them here for type safety, as DocumentSnapshot is a broader type used in the Event.
    const beforeData = (event.data.before as QueryDocumentSnapshot | undefined)?.data();
    const afterData = (event.data.after as QueryDocumentSnapshot | undefined)?.data();
    const userId = event.params.userId; // Get the user ID from the path parameters

    // Check if the 'status' field changed to 'approved'.
    // This ensures the email is sent only when the user is *just* approved, not on other updates.
    const wasJustApproved =
        afterData && afterData.status === 'approved' && (!beforeData || beforeData.status !== 'approved');

    if (!wasJustApproved) {
      functions.logger.log('User approval status not met or no change for userId:', userId);
      return; // Exit if the approval condition is not met
    }

    // Ensure afterData is not undefined before accessing its properties.
    if (!afterData) {
        functions.logger.error('afterData is undefined for userId:', userId);
        return;
    }

    // The 'userName' variable is correctly used in the template literal.
    const userName = afterData.name || afterData.displayName || 'User'; // Get user's name, prioritizing 'name'
    const userEmail = afterData.email; // Get user's email

    // Log and exit if user email is not found.
    if (!userEmail) {
      functions.logger.error('User email not found for approved user userId:', userId);
      return;
    }

    functions.logger.log('User ' + userId + ' approved, attempting to send email to: ' + userEmail);

    // --- SMTP Configuration (same as above) ---
    const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    };

    // Validate SMTP configuration.
    if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.pass) {
      functions.logger.error('SMTP configuration is missing. Cannot send approval email.');
      return;
    }

    // Create a Nodemailer transporter.
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });

    // Define the email options for the approval notification.
    const mailOptions = {
      from: smtpConfig.user,
      to: userEmail,
      subject: 'Your account for The Life Coaching Cafe is Approved',
      // Email body using a template literal.
      text: `Hi ${userName},

Your account has been approved and live on The Life Coaching Cafe.
Thank you for joining us.
Kind Regards

The Life Coaching Cafe Team`,
    };

    try {
      // Send the approval email.
      await transporter.sendMail(mailOptions);
      functions.logger.log('User approval email sent to: ' + userEmail + ' for userId: ' + userId);
    } catch (error) {
      // Log any errors during email sending.
      functions.logger.error('Error sending user approval email for userId: ' + userId, error);
    }
  }
);

// Re-export other functions from separate files if they exist.
// This allows you to organize your functions into multiple TypeScript files
// and export them all from index.ts.
export * from './stripe';
export * from './contact';