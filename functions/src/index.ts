import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import {
  onDocumentUpdated,
  onDocumentCreated,
  type FirestoreEvent,
  type QueryDocumentSnapshot,
  type Change,
} from "firebase-functions/v2/firestore";
import {
  beforeUserCreated,
  type AuthBlockingEvent,
  type AuthUserRecord,
} from "firebase-functions/v2/identity";
import { HttpsError, onCall } from "firebase-functions/v2/https";

// Export Stripe functions
export * from "./stripe";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
  console.log("Firebase Admin SDK initialized in index.ts");
} else {
  console.log("Firebase Admin SDK already initialized (index.ts)");
}

let transporterInstance: nodemailer.Transporter | undefined;
let smtpConfigCache: any | undefined;

function getSmtpConfig(): any | undefined {
  if (smtpConfigCache) {
    return smtpConfigCache;
  }

  const host = process.env.SMTP_HOST;
  const portStr = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secureStr = process.env.SMTP_SECURE;

  if (host && portStr && user && pass && secureStr) {
    const port = Number(portStr);
    if (isNaN(port)) {
      console.error(`Invalid SMTP_PORT: "${portStr}". Must be a number.`);
      return undefined;
    }

    smtpConfigCache = {
      host: host,
      port: port,
      user: user,
      pass: pass,
      secure: secureStr?.toLowerCase() === "true",
    };
    console.log("SMTP configuration loaded from environment variables.");
    return smtpConfigCache;
  } else {
    console.error(
      "SMTP configuration error: One or more required environment variables " +
        "(SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE) are missing or empty."
    );
    // Log which specific variables are missing for easier debugging
    if (!host) console.error("SMTP_HOST is missing or empty.");
    if (!portStr) console.error("SMTP_PORT is missing or empty.");
    if (!user) console.error("SMTP_USER is missing or empty.");
    if (!pass) console.error("SMTP_PASS is missing or empty.");
    if (!secureStr) console.error("SMTP_SECURE is missing or empty.");
    return undefined;
  }
}

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
        port: currentSmtpConfig.port as number,
        secure: currentSmtpConfig.secure as boolean,
        auth: {
          user: currentSmtpConfig.user as string,
          pass: currentSmtpConfig.pass as string,
        },
      });
      console.log(
        "Nodemailer transporter configured on demand."
      ); return transporterInstance;
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
        "is not fully set from environment variables. Cannot initialize " +
        "transporter."
    );
    return undefined;
  }
}

interface UserData {
  isApproved?: boolean;
  email?: string;
  displayName?: string;
  role?: string;
  status?: string;
}

interface MessageData {
  recipientId?: string;
  senderId?: string;
  senderName?: string;
  text?: string;
  createdAt?: admin.firestore.Timestamp;
  conversationId?: string;
}

interface BlogPostData {
  authorId?: string;
  status?: string;
  title?: string;
  slug?: string;
}

export const onUserApproved = onDocumentUpdated(
  "users/{userId}",
  async (event: FirestoreEvent<
      Change<QueryDocumentSnapshot> | undefined,
      {
 userId: string
} >
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

    const currentSmtpConfig = getSmtpConfig();

    const justApproved =
      (after?.status === "approved" && before?.status !== "approved") ||
      (after?.isApproved === true && before?.isApproved !== true);

    if (
      justApproved &&
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
          <p>Your account on The Life Coaching Cafe has been approved.</p>
          <p>You can now log in and enjoy our services.</p>
          <p>Thanks,</p>
          <p>The Life Coaching Cafe Team</p>
        `,
      };

      try {
        console.log("Sending approval email to " + userEmail + " for user " + userId);
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
          if (errWithResponse.response) { console.error(
            "Nodemailer error response:",
            errWithResponse.response.body
            );
          }
        }
      }
    } else {
      if (!justApproved) {
      }
      if (!after?.email) {
      }
      if (!currentSmtpConfig?.user) {
      }
    }
    return null;
  }
);

export const blockSuspendedUsersOnSignup = beforeUserCreated(async (event: AuthBlockingEvent) => {
  if (!event.data) {
    console.log("User data is undefined in beforeUserCreated event. Allowing creation by default.");
    return;
  }
  const user: AuthUserRecord = event.data;
  const email = user.email;

  if (!email) {
    console.log("User email is undefined in beforeUserCreated event data. Allowing creation.");
    return;
  }

  try {
    const usersRef = admin.firestore().collection("users");
    const querySnapshot = await usersRef.where("email", "==", email).limit(1).get();

    if (!querySnapshot.empty) {
      const userData = querySnapshot.docs[0].data();
      if (userData.status === "suspended") {
        throw new HttpsError("permission-denied", "This account has been suspended.");
      }
    }
  } catch (error) {
    throw error;
  }
});

export const onNewMessage = onDocumentCreated(
  "messages/{messageId}",
  async (event: FirestoreEvent<
      QueryDocumentSnapshot | undefined,
      {
 messageId: string
} >
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
      messageData.text ? (messageData.text.length > 100 ? messageData.text.substring(0, 97) + "..." : messageData.text) : "a new message.";

    if (!recipientId) { console.error("No recipientId found for message " + messageId); return null; }

    const currentSmtpConfig = getSmtpConfig();

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
        from: currentSmtpConfig.user as string,
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

      console.log("Sending new message notification to " + recipientEmail + " for message " + messageId);
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
          if (errWithResponse.response) { console.error(
            "Nodemailer error response:",
            errWithResponse.response.body
          );
        }
      }
    }
    return null;
  }
);

export const onBlogPostApproved = onDocumentUpdated(
  "blogs/{blogId}",
  async (event: FirestoreEvent<
      Change<QueryDocumentSnapshot> | undefined,
      {
 blogId: string
} >
  ) => {
    const transporter = await getTransporter();
    if (!transporter) {
      console.error(
        "Nodemailer transporter not available.",
        "Email for blog post approval not sent for blogId:", event.params.blogId
      );
      return null;
    }

    if (!event.data || !event.data.before || !event.data.after) {
      console.log(
        "Event data, before, or after snapshot is missing for onBlogPostApproved, blogId:", event.params.blogId
      );
      return null;
    }

    const before = event.data.before.data() as BlogPostData | undefined;
    const after = event.data.after.data() as BlogPostData | undefined;
    const blogId = event.params.blogId;

    const currentSmtpConfig = getSmtpConfig();

    const justApproved = after?.status === "approved" && before?.status !== "approved";

    if (justApproved && after?.authorId && after?.title && currentSmtpConfig?.user) {
      const authorId = after.authorId;
      const blogTitle = after.title;

      try {
        const userDoc = await admin.firestore().collection("users").doc(authorId).get();
        if (!userDoc.exists) {
          console.warn(
            `Author user document ${authorId} not found for blog ${blogId}. Cannot send approval email.`
          );
          return null;
        }

        const authorData = userDoc.data() as UserData | undefined;
        if (!authorData || !authorData.email) {
          console.error(
            `No email found for author user ${authorId} of blog ${blogId}. Cannot send approval email.`
          );
          return null;
        }

        const authorEmail = authorData.email;
        const authorName = authorData.displayName || "Author";

        const msg = {
          to: authorEmail,
          from: currentSmtpConfig.user as string,
          subject: `Your Blog Post "${blogTitle}" has been Approved!`,
          html: `
            <h1>Hi ${authorName},</h1>
            <p>Great news! Your blog post titled "<strong>${blogTitle}</strong>" has been approved and is now live on The Life Coaching Cafe.</p>
            <p>You can view it here: [TODO: Add link to blog post if slug is available and you have a URL structure]</p>
            <p>Thanks for your contribution,</p>
            <p>The Life Coaching Cafe Team</p>
          `,
        };

        console.log(`Sending blog post approval email to ${authorEmail} for blog ${blogId}`);
        await transporter.sendMail(msg);
        console.log(`Blog post approval email sent to ${authorEmail} for blog ${blogId}`);

      } catch (error: unknown) {
        console.error(
          `Error processing blog post approval for blog ${blogId}, author ${authorId}:`,
          error
        );
        if (typeof error === "object" && error !== null && "response" in error) {
          const errWithResponse = error as { response?: { body?: unknown } };
          if (errWithResponse.response) {
            console.error("Nodemailer error response:", errWithResponse.response.body);
          }
        }
      }
    } else {
      if (!justApproved) {
      }
       if (!currentSmtpConfig?.user) {
      }
    }
    return null;
  }
);

export const suspendUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  if (request.auth.token.admin !== true) {
    console.error("Unauthorized attempt to suspend user by:", request.auth.uid);
    throw new HttpsError("permission-denied", "You do not have permission to suspend users.");
  }
  const userId = request.data.userId;
  if (!userId || typeof userId !== 'string') {
    throw new HttpsError("invalid-argument", "The function must be called with a valid 'userId' string argument.");
  }
  try {
    await admin.auth().updateUser(userId, {
      disabled: true,
    });
    console.log(`Successfully disabled Firebase Auth for user: ${userId}`);
    const userRef = admin.firestore().collection("users").doc(userId);
    await userRef.update({
      status: "suspended",
    });
    console.log(`Successfully updated Firestore status to 'suspended' for user: ${userId}`);
    return { success: true, message: `User ${userId} has been suspended.` };
  } catch (error) {
    console.error(`Error suspending user ${userId}:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", `An internal error occurred while suspending user ${userId}.`);
  }
});

export const unsuspendUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  if (request.auth.token.admin !== true) {
    console.error("Unauthorized attempt to unsuspend user by:", request.auth.uid);
    throw new HttpsError("permission-denied", "You do not have permission to unsuspend users.");
  }
  const userId = request.data.userId;
  if (!userId || typeof userId !== 'string') {
    throw new HttpsError("invalid-argument", "The function must be called with a valid 'userId' string argument.");
  }
  try {
    await admin.auth().updateUser(userId, {
      disabled: false, 
    });
    console.log(`Successfully enabled Firebase Auth for user: ${userId}`);
    const userRef = admin.firestore().collection("users").doc(userId);
    await userRef.update({
      status: "active", 
    });
    console.log(`Successfully updated Firestore status to 'active' for user: ${userId}`);
    return { success: true, message: `User ${userId} has been unsuspended.` };
  } catch (error) {
    console.error(`Error unsuspending user ${userId}:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", `An internal error occurred while unsuspending user ${userId}.`);
  }
});

export const setAdminClaim = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "The function must be called while authenticated.");
  }
  if (request.auth.token.admin !== true) {
    console.error("Unauthorized attempt to set admin claim by user:", request.auth.uid);
    throw new HttpsError("permission-denied", "You do not have permission to set admin claims.");
  }
  const email = request.data.email;
  if (!email || typeof email !== 'string') {
    throw new HttpsError("invalid-argument", "The function must be called with a valid 'email' string argument (the user to make admin).");
  }
  try {
    const userToMakeAdmin = await admin.auth().getUserByEmail(email);
    if (!userToMakeAdmin) {
      throw new HttpsError("not-found", `User with email ${email} not found.`);
    }
    await admin.auth().setCustomUserClaims(userToMakeAdmin.uid, { admin: true });
    console.log(`Successfully set admin claim for user: ${userToMakeAdmin.uid} (${email})`);
    return { success: true, message: `User ${email} has been made an admin.` };
  } catch (error) {
    console.error(`Error setting admin claim for email ${email}:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    if ((error as any).code === 'auth/user-not-found') {
        throw new HttpsError("not-found", `User with email ${email} not found.`);
    }
    throw new HttpsError("internal", `An internal error occurred while setting admin claim for ${email}.`);
  }
});
