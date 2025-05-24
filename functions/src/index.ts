import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import * as functions from "firebase-functions"; // For functions.config()
import {
  onDocumentUpdated,
  onDocumentCreated,
  FirestoreEvent,
  QueryDocumentSnapshot,
  Change,
} from "firebase-functions/v2/firestore";

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// --- Nodemailer Transporter Lazy Initialization ---
let transporterInstance: nodemailer.Transporter | undefined;
// Using 'any' for smtpConfigObject to simplify type issues
// with functions.config() The structure { smtp: { ... } } is still expected.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let smtpConfigObject: any | undefined;

/**
 * Retrieves the SMTP configuration.
 * It fetches the configuration on the first call and caches it.
 * Supports emulator environment variables.
 * @return {any | undefined} The SMTP configuration object ({host, port...}),
 * or undefined if not found.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line require-jsdoc
function getSmtpConfig(): any | undefined {
  if (!smtpConfigObject) {
    if (process.env.FUNCTIONS_EMULATOR) {
      const portStr = process.env.SMTP_PORT;
      smtpConfigObject = {
        smtp: {
          host: process.env.SMTP_HOST,
          port: portStr ? Number(portStr) : undefined,
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
          secure: process.env.SMTP_SECURE === "true",
        },
      };
    } else {
      smtpConfigObject = functions.config();
    }
  }
  return smtpConfigObject?.smtp;
}

/**
 * Retrieves or initializes the Nodemailer transporter.
 * Transporter is created on first call and cached.
 * @return {Promise<nodemailer.Transporter | undefined>} A promise that
 * resolves to the transporter instance or undefined if initialization fails.
 */
// eslint-disable-next-line require-jsdoc
async function getTransporter():
  Promise<nodemailer.Transporter | undefined> {
  if (transporterInstance) {
    return transporterInstance;
  }

  const currentSmtpConfig = getSmtpConfig();

  if (
    currentSmtpConfig &&
    currentSmtpConfig.host &&
    currentSmtpConfig.port &&
    currentSmtpConfig.user &&
    currentSmtpConfig.pass
  ) {
    try {
      transporterInstance = nodemailer.createTransport({
        host: currentSmtpConfig.host as string,
        port:
          typeof currentSmtpConfig.port === "string" ?
            parseInt(currentSmtpConfig.port, 10) :
            currentSmtpConfig.port as number,
        secure:
          currentSmtpConfig.secure === true ||
          currentSmtpConfig.secure === "true",
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
      "SMTP configuration (host, port, user, pass, secure) " +
      "is not fully set. Cannot initialize transporter."
    );
    return undefined;
  }
}

interface UserData {
  isApproved?: boolean;
  email?: string;
  displayName?: string;
}

interface MessageData {
  recipientId?: string;
  senderName?: string;
  text?: string;
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
        "Event data, before, or after snapshot is missing."
      );
      return null;
    }

    const before = event.data.before.data() as UserData | undefined;
    const after = event.data.after.data() as UserData | undefined;
    const userId = event.params.userId;

    const currentSmtpConfig = getSmtpConfig();

    if (
      after?.isApproved &&
      !before?.isApproved &&
      after?.email &&
      currentSmtpConfig?.user
    ) {
      const userEmail = after.email;
      const userName = after.displayName || "User";

      const msg = {
        to: userEmail,
        from: currentSmtpConfig.user as string,
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
          "Error sending approval email:",
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
              errWithResponse.response.body
            );
          }
        }
      }
    } else {
      if (!after?.email) {
        console.log(
          "User " + userId + " approved but no email found."
        );
      }
      if (!currentSmtpConfig?.user) {
        console.log(
          "SMTP user not configured, cannot send email."
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
        "No data for message " + messageId
      );
      return null;
    }

    const recipientId = messageData.recipientId;
    const senderName = messageData.senderName || "Someone";

    const messageTextPreview =
      messageData.text ?
        messageData.text.substring(0, 100) + "..." :
        "a new message.";

    if (!recipientId) {
      console.error(
        "No recipientId found for message " + messageId
      );
      return null;
    }

    const currentSmtpConfig = getSmtpConfig();

    try {
      const userDoc = await admin
        .firestore()
        .collection("users")
        .doc(recipientId)
        .get();

      let recipientData: UserData | undefined;
      if (!userDoc.exists) {
        console.warn( // Changed to warn and handling the case
          "Recipient user document " +
          recipientId + " not found. Using default 'Unknown User'."
        );
        recipientData = { // Provide a default object
          displayName: "Unknown User",
          email: undefined, // Explicitly undefined as we can't send email
        };
      } else {
        recipientData = userDoc.data() as UserData | undefined;
      }

      if (!recipientData || !recipientData.email) {
        console.error(
          "No email found for recipient user " + recipientId +
          (recipientData?.displayName === "Unknown User" ? " (defaulted, no user doc)" : "")
        );
        return null;
      }

      if (!currentSmtpConfig?.user) {
        console.error(
          "SMTP user not configured, cannot send email."
        );
        return null;
      }

      const recipientEmail = recipientData.email;
      // Fallback for displayName is now handled by the default object or existing data.
      const recipientName = recipientData.displayName || "User";


      const msg = {
        to: recipientEmail,
        from: currentSmtpConfig.user as string,
        subject:
          "You have received a new message from " +
          senderName,
        html: `
          <h1>Hi ${recipientName},</h1>
          <p>You have a new message from ${senderName}:</p>
          <blockquote>${messageTextPreview}</blockquote>
          <p>Log in to view the full message.</p>
          <p>Thanks,</p>
          <p>The Team</p>
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
        "Error sending new message email:",
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
            errWithResponse.response.body
          );
        }
      }
    }
    return null;
  }
);
