const productionBaseUrl = "https://www.thelifecoachingcafe.com";

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {onCall} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import Stripe from "stripe";

admin.initializeApp();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

const corsConfig = [
  /thelifecoachingcafe\.com$/,
  /localhost:3000/,
  /localhost:3001/,
  /https:\/\/\d+-firebase-studio-1747477108457\.cluster-6vyo4gb53jczovun3dxslzjahs\.cloudworkstations\.dev/,
];

/**
 * Creates a Stripe Checkout session for a user to subscribe.
 */
export const createCheckoutSessionCallable = onCall(
    {
      secrets: [stripeSecretKey],
      cors: corsConfig,
    },
    async (request) => {
      if (!request.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
      }

      const {priceId, successUrl, cancelUrl} = request.data;
      const userId = request.auth.uid; // Use the authenticated user's ID for security.

      const stripe = new Stripe(stripeSecretKey.value());

      try {
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          mode: "subscription",
          success_url: successUrl,
          cancel_url: cancelUrl,
          client_reference_id: userId,
          metadata: {
            subscription_tier: "premium",
          },
        });

        return {sessionId: session.id};
      } catch (error) {
        console.error("Stripe Checkout Session Error:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Unable to create checkout session."
        );
      }
    }
);

/**
 * Deletes a user account, including their data and Stripe subscription.
 * This version uses a Firestore batch write to ensure atomic deletion of documents.
 */
export const deleteUserAccount = onCall(
    {
      secrets: [stripeSecretKey],
      cors: corsConfig,
    },
    async (request) => {
      if (!request.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "You must be authenticated to delete your account."
        );
      }

      const uid = request.auth.uid;
      const db = admin.firestore();
      const userDocRef = db.collection("users").doc(uid);
      const stripe = new Stripe(stripeSecretKey.value());

      try {
        const userDoc = await userDocRef.get();

        // If the user document doesn't exist, just delete the auth user.
        if (!userDoc.exists) {
          await admin.auth().deleteUser(uid);
          console.log(`Auth user ${uid} deleted. No Firestore doc was found.`);
          return {message: "Account deleted successfully."};
        }

        const userData = userDoc.data()!;

        // First, attempt to cancel any active Stripe subscription.
        // We log errors but don't block deletion if this fails, as the subscription
        // might already be cancelled or have issues unrelated to our database.
        if (userData.stripeSubscriptionId) {
          try {
            await stripe.subscriptions.cancel(userData.stripeSubscriptionId);
            console.log(
                `Stripe subscription ${
                  userData.stripeSubscriptionId
                } for user ${uid} cancelled.`
            );
          } catch (error) {
            console.error(
                `Failed to cancel Stripe subscription for user ${uid}. This might have been already cancelled or the ID is invalid. Continuing with account deletion. Error:`,
                error
            );
          }
        }

        // Use a Firestore batch for atomic deletion of related documents.
        const batch = db.batch();

        // Add the main user document to the batch for deletion.
        batch.delete(userDocRef);

        // If the user is a coach, also add their coach profile to the batch.
        if (userData.role === "coach") {
          const coachProfileRef = db.collection("coachProfiles").doc(uid);
          batch.delete(coachProfileRef);
        }

        // Commit the batch. If this fails, it will throw an error,
        // and the auth user will NOT be deleted.
        await batch.commit();
        console.log(`Firestore documents for user ${uid} deleted successfully.`);

        // ONLY after successful deletion of Firestore documents, delete the Auth user.
        await admin.auth().deleteUser(uid);
        console.log(`Firebase Auth user ${uid} deleted.`);

        return {
          message: "Your account and all associated data have been permanently deleted.",
        };
      } catch (error) {
        console.error(`Error deleting account for user ${uid}:`, error);
        // This unified error handling will catch failures from Firestore, Auth, etc.
        throw new functions.https.HttpsError(
            "internal",
            "An error occurred while deleting your account. Please contact support."
        );
      }
    }
);


/**
 * Helper function to send a templated email.
 * @param {string} email The recipient's email address.
 * @param {string} templateName The name of the email template document.
 * @param {Record<string, unknown>} templateData The data for the template.
 */
const sendEmail = async (
    email: string,
    templateName: string,
    templateData: Record<string, unknown>
) => {
  if (!email) {
    console.error("No email address provided to sendEmail function.");
    return;
  }
  try {
    await admin.firestore().collection("mail").add({
      to: [email],
      template: {
        name: templateName,
        data: templateData,
      },
    });
    console.log(`Email with template ${templateName} queued for ${email}.`);
  } catch (error) {
    console.error(
        `Failed to send email to ${email} with template ${templateName}:`,
        error
    );
  }
};

/**
 * Sends a welcome email to a new user upon their creation in Firestore.
 */
export const sendWelcomeEmailOnUserCreate = onDocumentCreated(
    "users/{userId}",
    async (event) => {
      const snap = event.data;
      if (!snap) return;

      const {name, role, subscriptionTier} = snap.data();
      let templateName;

      if (subscriptionTier === "premium" && role === "coach") {
        templateName = "welcome_coach_premium";
      } else if (role === "coach") {
        templateName = "welcome_coach_free";
      } else if (role === "user") {
        templateName = "welcome_user";
      } else {
        return;
      }

      const userRecord = await admin.auth().getUser(event.params.userId);
      await sendEmail(userRecord.email!, templateName, {
        name: name || "new user",
      });
    }
);

/**
 * Sends an email when a user upgrades to the premium subscription tier.
 */
export const onUserUpgradeToPremium = onDocumentUpdated(
    "users/{userId}",
    async (event) => {
      if (!event.data?.before || !event.data?.after) return;

      const before = event.data.before.data();
      const after = event.data.after.data();

      if (
        before.subscriptionTier !== "premium" &&
      after.subscriptionTier === "premium"
      ) {
        const userRecord = await admin.auth().getUser(event.params.userId);
        await sendEmail(userRecord.email!, "user_upgraded_to_premium", {
          name: after.name || "there",
        });
      }
    }
);

/**
 * Sends a notification email when a new chat message is received.
 */
export const onNewChatMessage = onDocumentCreated(
    "messages/{messageId}",
    async (event) => {
      const snap = event.data;
      if (!snap) return;

      const {recipientId, senderName, conversationId} = snap.data();

      try {
        const userDoc = await admin.firestore().collection("users").doc(recipientId).get();
        if (!userDoc.exists) {
          console.error(`User profile for recipient ${recipientId} not found.`);
          return;
        }
        const userData = userDoc.data();
        const userRole = userData?.role;

        let dashboardPath;
        switch (userRole) {
          case "coach":
            dashboardPath = "/dashboard/coach/messages";
            break;
          case "admin":
            dashboardPath = "/dashboard/admin/messages";
            break;
          case "user":
          default:
            dashboardPath = "/dashboard/user/messages";
            break;
        }

        const conversationUrl = `${productionBaseUrl}${dashboardPath}/${conversationId}`;

        const userRecord = await admin.auth().getUser(recipientId);
        await sendEmail(userRecord.email!, "new_chat_message", {
          senderName: senderName || "Someone",
          recipientName: userRecord.displayName || "there",
          conversationUrl: conversationUrl,
        });
      } catch (error) {
        console.error(`Error processing new chat message for recipient ${recipientId}:`, error);
      }
    }
);

/**
 * Sends an email to a blog author.
 * @param {string} authorId ID of the blog author.
 * @param {string} blogTitle Title of the blog post.
 * @param {string} template Template name for the email.
 * @param {string | undefined} slug The slug of the blog post.
 */
const sendBlogEmail = async (
    authorId: string,
    blogTitle: string,
    template: string,
    slug?: string
) => {
  const userRecord = await admin.auth().getUser(authorId);
  const templateData: Record<string, unknown> = {
    name: userRecord.displayName || "Coach",
    blogTitle: blogTitle,
  };

  if (slug) {
    templateData.postUrl = `${productionBaseUrl}/blog/${slug}`;
  }

  await sendEmail(userRecord.email!, template, templateData);
};

/**
 * Sends an email to a coach when their blog post is submitted for review.
 */
export const onBlogPendingReview = onDocumentCreated(
    "blogs/{blogId}",
    async (event) => {
      const snap = event.data;
      if (!snap) return;

      const {authorId, title, status} = snap.data();
      if (status !== "pending") return;

      await sendBlogEmail(authorId, title, "blog_pending_review");
    }
);

/**
 * Sends an email to a coach when their blog post is approved and published.
 */
export const onBlogPublished = onDocumentUpdated(
    "blogs/{blogId}",
    async (event) => {
      if (!event.data?.before || !event.data?.after) return;

      const before = event.data.before.data();
      const after = event.data.after.data();

      if (before.status === "pending" && after.status === "published") {
        await sendBlogEmail(after.authorId, after.title, "blog_approved", after.slug);
      }
    }
);
