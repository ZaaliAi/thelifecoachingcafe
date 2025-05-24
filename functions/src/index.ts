
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as sgMail from "@sendgrid/mail"; // Changed to import * as sgMail

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Set SendGrid API Key from Firebase environment configuration
const SENDGRID_API_KEY = functions.config().sendgrid?.key; // Added optional chaining

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.error(
    "SendGrid API Key not found in Firebase config. " +
    "Set it with: firebase functions:config:set sendgrid.key="YOUR_ACTUAL_SENDGRID_API_KEY" " +
    "and deploy functions again."
  );
}

// --- Email for User Approval ---
export const onUserApproved = functions.firestore
  .document("users/{userId}")
  .onUpdate(async (change, context) => {
    const newData = change.after.data();
    const previousData = change.before.data();
    const userId = context.params.userId;

    // Check if the user was just approved and has an email
    if (newData.isApproved && !previousData.isApproved && newData.email) {
      const userEmail = newData.email;
      const userName = newData.displayName || "User";

      if (!SENDGRID_API_KEY) {
        console.error("SendGrid API key not configured. Email not sent.");
        return null;
      }

      const msg = {
        to: userEmail,
        from: "youremail@yourverifieddomain.com", // IMPORTANT: Replace with your verified SendGrid sender email
        subject: "Your Account has been Approved!",
        html: `
          <h1>Welcome, ${userName}!</h1>
          <p>Your account on Our Platform has been approved.</p>
          <p>You can now log in and enjoy our services.</p>
          <p>Thanks,</p>
          <p>The Team</p>
        `,
      };

      try {
        console.log(`Sending approval email to ${userEmail} for user ${userId}`);
        await sgMail.send(msg);
        console.log(`Approval email sent to ${userEmail}`);
      } catch (error: any) { // Added type for error
        console.error("Error sending approval email:", userId, error);
        if (error.response) {
          console.error(error.response.body);
        }
      }
    } else {
      if (!newData.email) {
        console.log(`User ${userId} approved but no email found.`);
      }
    }
    return null;
  });

// --- Email for New Message ---
// This example assumes messages are in a 'messages' collection
// and each message has a 'recipientId', 'senderName', and 'text'.
// It fetches the recipient's email from the 'users' collection.
export const onNewMessage = functions.firestore
  .document("messages/{messageId}") // Adjust path as per your Firestore structure
  .onCreate(async (snapshot, context) => {
    const messageData = snapshot.data();
    const messageId = context.params.messageId;

    if (!messageData) {
        console.error(`No data for message ${messageId}`);
        return null;
    }

    const recipientId = messageData.recipientId; // User ID of the recipient
    const senderName = messageData.senderName || "Someone";
    const messageTextPreview = messageData.text
      ? messageData.text.substring(0, 100) + "..."
      : "a new message.";

    if (!recipientId) {
      console.error(`No recipientId found for message ${messageId}`);
      return null;
    }

    if (!SENDGRID_API_KEY) {
      console.error("SendGrid API key not configured. Email not sent.");
      return null;
    }

    try {
      const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(recipientId)
        .get();

      if (!userDoc.exists) {
        console.error(`Recipient user document ${recipientId} not found.`);
        return null;
      }

      const recipientData = userDoc.data();
      if (!recipientData || !recipientData.email) {
        console.error(`No email found for recipient user ${recipientId}`);
        return null;
      }

      const recipientEmail = recipientData.email;
      const recipientName = recipientData.displayName || "User";

      const msg = {
        to: recipientEmail,
        from: "youremail@yourverifieddomain.com", // IMPORTANT: Replace with your verified SendGrid sender email
        subject: `You've received a new message from ${senderName}`,
        html: `
          <h1>Hi ${recipientName},</h1>
          <p>You have a new message from ${senderName}:</p>
          <blockquote>${messageTextPreview}</blockquote>
          <p>Log in to view the full message.</p>
          <p>Thanks,</p>
          <p>The Team</p>
        `,
      };

      console.log(`Sending new message notification to ${recipientEmail} for message ${messageId}`);
      await sgMail.send(msg);
      console.log(`New message email sent to ${recipientEmail}`);
    } catch (error: any) { // Added type for error
      console.error("Error sending new message email:", messageId, error);
      if (error.response) {
        console.error(error.response.body);
      }
    }
    return null;
  });

