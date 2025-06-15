
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import {
  onDocumentCreated,
  onDocumentUpdated,
} from "firebase-functions/v2/firestore";
import {onRequest, onCall} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import Stripe from "stripe";

admin.initializeApp();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

/**
 * Deletes a user account, including their data and Stripe subscription.
 */
export const deleteUserAccount = onCall(
  {
    secrets: [stripeSecretKey],
    cors: [/thedanvail\.com$/, /thelifecoachingcafe\.com$/],
  },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be authenticated to delete your account."
      );
    }

    const uid = request.auth.uid;
    const userDocRef = admin.firestore().collection("users").doc(uid);

    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: "2025-05-28.basil",
    });

    try {
      const userDoc = await userDocRef.get();
      if (!userDoc.exists) {
        await admin.auth().deleteUser(uid);
        return {message: "Account deleted successfully."};
      }

      const userData = userDoc.data()!;

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
            `Failed to cancel Stripe subscription ${
              userData.stripeSubscriptionId
            } for user ${uid}. It might have been already cancelled. Error:`,
            error
          );
        }
      }

      await userDocRef.delete();

      if (userData.role === "coach") {
        const coachProfileRef = admin
          .firestore()
          .collection("coachProfiles")
          .doc(uid);
        const coachProfileDoc = await coachProfileRef.get();
        if (coachProfileDoc.exists) {
          await coachProfileRef.delete();
        }
      }

      console.log(`Firestore documents for user ${uid} deleted.`);

      await admin.auth().deleteUser(uid);
      console.log(`Firebase Auth user ${uid} deleted.`);

      return {
        message:
          "Your account and all associated data have been permanently deleted.",
      };
    } catch (error) {
      console.error(`Error deleting account for user ${uid}:`, error);
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
 * @param {object} templateData The data to pass to the email template.
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

    const {recipientId, senderName} = snap.data();

    const userRecord = await admin.auth().getUser(recipientId);
    await sendEmail(userRecord.email!, "new_chat_message", {
      senderName: senderName || "Someone",
      recipientName: userRecord.displayName || "there",
    });
  }
);

/**
 * Sends an email to a blog author.
 * @param {string} authorId ID of the blog author.
 * @param {string} blogTitle Title of the blog post.
 * @param {string} template Template name for the email.
 */
const sendBlogEmail = async (
  authorId: string,
  blogTitle: string,
  template: string
) => {
  const userRecord = await admin.auth().getUser(authorId);
  await sendEmail(userRecord.email!, template, {
    name: userRecord.displayName || "Coach",
    blogTitle: blogTitle,
  });
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
      await sendBlogEmail(after.authorId, after.title, "blog_approved");
    }
  }
);

export const createCheckoutSessionCallable = onCall(
  {
    secrets: [stripeSecretKey],
    cors: [/thedanvail\.com$/, /thelifecoachingcafe\.com$/],
  },
  async (request) => {
    if (!request.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const {priceId, successUrl, cancelUrl} = request.data as any;
    const userId = request.auth.uid;

    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: "2025-05-28.basil",
    });

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
 * Stripe webhook handler to process subscription payments.
 */
export const onSubscriptionActivated = onRequest(
  {
    secrets: [stripeSecretKey, stripeWebhookSecret],
    cors: [/thedanvail\.com$/, /thelifecoachingcafe\.com$/],
  },
  async (request, response) => {
    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: "2025-05-28.basil",
    });

    const signature = request.headers["stripe-signature"];
    if (!signature) {
      response.status(400).send("Missing Stripe signature.");
      return;
    }

    let webhookEvent;
    try {
      webhookEvent = stripe.webhooks.constructEvent(
        request.rawBody,
        signature,
        stripeWebhookSecret.value()
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      response.status(400).send(`Webhook Error: ${msg}`);
      return;
    }

    if (webhookEvent.type === "checkout.session.completed") {
      const session = webhookEvent.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id;

      if (!userId) {
        console.error("Critical: checkout.session.completed missing userId.");
        response
          .status(200)
          .send("Event handled, but no userId was present.");
        return;
      }

      const subscriptionId = session.subscription;
      const customerId = session.customer;
      const subscriptionTier =
        session.metadata?.subscription_tier || "premium";

      if (!subscriptionId || !customerId) {
        console.error(
          `Critical: Missing subscription or customer ID for user ${userId}.`
        );
        response
          .status(200)
          .send("Event handled, but subscription or customer ID was missing.");
        return;
      }

      try {
        await admin.firestore().collection("users").doc(userId).update({
          subscriptionTier: subscriptionTier,
          stripeSubscriptionId: subscriptionId,
          stripeCustomerId: customerId.toString(),
          subscriptionStatus: "active",
        });
        console.log(
          `Successfully updated user ${userId} to premium subscription.`
        );
      } catch (error) {
        console.error(
          `Failed to update user ${userId} in Firestore:`,
          error
        );
        response.status(500).send("Failed to update user record in Firestore.");
        return;
      }
    }

    response.status(200).send("Event received.");
  }
);
