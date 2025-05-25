import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
// Removed: import * as functions from "firebase-functions";
import {
  onDocumentUpdated,
  onDocumentCreated,
  type FirestoreEvent,
  type QueryDocumentSnapshot,
  type Change,
} from "firebase-functions/v2/firestore";

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// --- Nodemailer Transporter Lazy Initialization ---
let transporterInstance: nodemailer.Transporter | undefined;

// Cache for the SMTP configuration details, directly holding {host, port, user, pass, secure}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let smtpDirectConfigCache: any | undefined;

/**
 * Retrieves the SMTP configuration directly from environment variables.
 * It fetches the configuration on the first call and caches it.
 * @return {any | undefined} The SMTP configuration object 
 * ({host, port, user, pass, secure}), or undefined if not fully configured.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSmtpConfig(): any | undefined {
  if (smtpDirectConfigCache) {
    return smtpDirectConfigCache;
  }

  const host = process.env.SMTP_HOST;
  const portStr = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true"; // Corrected this line

  if (host && portStr && user && pass) {
    const port = Number(portStr);
    if (isNaN(port)) {
      console.error(`Invalid SMTP_PORT: "${portStr}". Must be a number.`);
      return undefined;
    }

    smtpDirectConfigCache = {
      host: host,
      port: port,
      user: user,
      pass: pass,
      secure: secure,
    };
    console.log("SMTP configuration loaded from environment variables.");
    return smtpDirectConfigCache;
  } else {
    console.error(
      "SMTP configuration error: One or more required environment variables " +
      "(SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) are missing or empty."
    );
    if (!host) console.error("SMTP_HOST is missing or empty.");
    if (!portStr) console.error("SMTP_PORT is missing or empty.");
    if (!user) console.error("SMTP_USER is missing or empty.");
    if (!pass) console.error("SMTP_PASS is missing or empty.");
    // SMTP_SECURE is optional and defaults to false effectively if not "true"
    return undefined;
  }
}

/**
 * Retrieves or initializes the Nodemailer transporter.
 * Transporter is created on first call and cached.
 * @return {Promise<nodemailer.Transporter | undefined>} A promise that
 * resolves to the transporter instance or undefined if initialization fails.
 */
async function getTransporter():
  Promise<nodemailer.Transporter | undefined> {
  if (transporterInstance) {
    return transporterInstance;
  }

  const currentSmtpConfig = getSmtpConfig();

  if (
    currentSmtpConfig &&
    currentSmtpConfig.host &&
    currentSmtpConfig.port && // is a number
    currentSmtpConfig.user &&
    currentSmtpConfig.pass
    // currentSmtpConfig.secure is a boolean
  ) {
    try {
      transporterInstance = nodemailer.createTransport({
        host: currentSmtpConfig.host as string,
        port: currentSmtpConfig.port as number,
        secure: currentSmtpConfig.secure as boolean,
        auth: {
          user: currentSmtpConfig.user as string,
          pass: currentSmtpConfig.pass as string,
        },
      });
      console.log(
        "Nodemailer transporter configured on demand."
      );
      return transporterInstance;
    } catch (error) {
      console.error(
        "Failed to create Nodemailer transporter:",
        error
      );
      return undefined;
    }
  } else {
    console.error(
      "SMTP configuration (host, port, user, pass) " +
      "is not fully set from environment variables. Cannot initialize transporter."
    );
    return undefined;
  }
}

interface UserData {
  isApproved?: boolean;
  email?: string;
  displayName?: string;
  // Add other fields that might be present in user documents
  role?: string; // Example: if role influences approval or notifications
  status?: string; // Example: coach status like 'pending_approval'
}

interface MessageData {
  recipientId?: string;
  senderId?: string; // Good to have for context
  senderName?: string;
  text?: string;
  createdAt?: admin.firestore.Timestamp; // Example, if you use timestamps
  conversationId?: string; // If messages are part of conversations
}

// --- Email for User Approval ---
export const onUserApproved = onDocumentUpdated(
  "users/{userId}",
  async (
    event: FirestoreEvent<
      Change<QueryDocumentSnapshot> | undefined,
      { userId: string }
    >
  ) => {
    const transporter = await getTransporter();
    if (!transporter) {
      console.error(
        "Nodemailer transporter not available.",
        "Email for user approval not sent."
      );
      return null;
    }

    if (!event.data || !event.data.before || !event.data.after) {
      console.log(
        "Event data, before, or after snapshot is missing for onUserApproved."
      );
      return null;
    }

    const before = event.data.before.data() as UserData | undefined;
    const after = event.data.after.data() as UserData | undefined;
    const userId = event.params.userId;

    const currentSmtpConfig = getSmtpConfig(); // getSmtpConfig now returns the direct config object

    // Check if the status changed to 'approved' for a coach, or isApproved became true
    // Adapt this logic based on your exact approval mechanism
    const justApproved = (after?.status === "approved" && before?.status !== "approved") ||
                         (after?.isApproved === true && before?.isApproved !== true);

    if (
      justApproved &&
      after?.email &&
      currentSmtpConfig?.user // Check if SMTP sender email is configured
    ) {
      const userEmail = after.email;
      const userName = after.displayName || "User";

      const msg = {
        to: userEmail,
        from: currentSmtpConfig.user as string, // Sender email from SMTP config
        subject: "Your Account has been Approved!",
        html: `
          <h1>Welcome, ${userName}!</h1>
          <p>Your account on The Life Coaching Cafe has been approved.</p>
          <p>You can now log in and enjoy our services.</p>
          <p>Thanks,</p>
          <p>The Life Coaching Cafe Team</p>
        `,
      };

      try {
        console.log(
          "Sending approval email to " +
          userEmail + " for user " + userId
        );
        await transporter.sendMail(msg);
        console.log(
          "Approval email sent to:",
          userEmail
        );
      } catch (error: unknown) {
        console.error(
          "Error sending approval email for user:",
          userId, error
        );
        if (
          typeof error === "object" &&
          error !== null && "response" in error
        ) {
          const errWithResponse = error as {
            response?: { body?: unknown }
          };
          if (errWithResponse.response) {
            console.error(
              "Nodemailer error response:",
              errWithResponse.response.body
            );
          }
        }
      }
    } else {
      if (!justApproved) {
         // console.log(`User ${userId}: Approval status unchanged or not an approval event. Before: ${JSON.stringify(before)}, After: ${JSON.stringify(after)}`);
      }
      if (!after?.email) {
        console.log(
          "User " + userId + " data update occurred but no email found for notification."
        );
      }
      if (!currentSmtpConfig?.user) {
        console.log(
          "SMTP user (sender email) not configured, cannot send approval email."
        );
      }
    }
    return null;
  }
);

// --- Email for New Message ---
export const onNewMessage = onDocumentCreated(
  "messages/{messageId}",
  async (
    event: FirestoreEvent<
      QueryDocumentSnapshot | undefined,
      { messageId: string }
    >
  ) => {
    const transporter = await getTransporter();
    if (!transporter) {
      console.error(
        "Nodemailer transporter not available.",
        "Email for new message not sent."
      );
      return null;
    }

    if (!event.data) {
      console.log(
        "Event data is missing for onNewMessage."
      );
      return null;
    }

    const messageData = event.data.data() as MessageData | undefined;
    const messageId = event.params.messageId;

    if (!messageData) {
      console.error(
        "No data parsed for message " + messageId
      );
      return null;
    }

    const recipientId = messageData.recipientId;
    const senderName = messageData.senderName || "Someone";

    const messageTextPreview =
      messageData.text ?
        (messageData.text.length > 100 ? messageData.text.substring(0, 97) + "..." : messageData.text) :
        "a new message.";

    if (!recipientId) {
      console.error(
        "No recipientId found for message " + messageId
      );
      return null;
    }

    const currentSmtpConfig = getSmtpConfig(); // getSmtpConfig now returns the direct config object

    if (!currentSmtpConfig?.user) {
      console.error(
        "SMTP user (sender email) not configured, cannot send new message notification."
      );
      return null;
    }

    try {
      const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(recipientId)
        .get();

      if (!userDoc.exists) {
        console.warn(
          "Recipient user document " +
          recipientId + " not found. Cannot send new message email."
        );
        return null;
      }
      
      const recipientData = userDoc.data() as UserData | undefined;

      if (!recipientData || !recipientData.email) {
        console.error(
          "No email found for recipient user " + recipientId +
          ". Cannot send new message email."
        );
        return null;
      }

      const recipientEmail = recipientData.email;
      const recipientName = recipientData.displayName || "User";


      const msg = {
        to: recipientEmail,
        from: currentSmtpConfig.user as string, // Sender email from SMTP config
        subject:
          "You have received a new message from " +
          senderName,
        html: `
          <h1>Hi ${recipientName},</h1>
          <p>You have a new message from ${senderName}:</p>
          <blockquote>${messageTextPreview}</blockquote>
          <p>Log in to view the full message on The Life Coaching Cafe.</p>
          <p>Thanks,</p>
          <p>The Life Coaching Cafe Team</p>
        `,
      };

      console.log(
        "Sending new message notification to " +
        recipientEmail +
        " for message " + messageId
      );
      await transporter.sendMail(msg);
      console.log(
        "New message email sent to " + recipientEmail
      );
    } catch (error: unknown) {
      console.error(
        "Error sending new message email for messageId:",
        messageId, error
      );
      if (
        typeof error === "object" &&
        error !== null && "response" in error
      ) {
        const errWithResponse = error as {
          response?: { body?: unknown }
        };
        if (errWithResponse.response) {
          console.error(
            "Nodemailer error response:",
            errWithResponse.response.body
          );
        }
      }
    }
    return null;
  }
);
