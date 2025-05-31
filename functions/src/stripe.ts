import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

if (!admin.apps.length) {
  admin.initializeApp();
  console.log("Firebase Admin SDK initialized in stripe.ts");
} else {
  console.log("Firebase Admin SDK already initialized (stripe.ts)");
}

interface CreateCheckoutSessionData {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId?: string;
}

// Define an interface for the portal link data
interface CreateStripePortalLinkData {
  returnUrl: string;
}

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
let stripe: Stripe | undefined; // Stripe SDK instance, potentially undefined

if (!stripeSecretKey) {
  console.warn(
    "WARNING: STRIPE_SECRET_KEY environment variable was not found during this execution. " +
    "If this is a local analysis phase, it might be okay if the secret is set in Google Secret Manager for deployment. " +
    "If this is a live runtime, Stripe functions will fail."
  );
} else {
  console.log(
    "STRIPE_SECRET_KEY found. Attempting to initialize Stripe SDK. Key (first 10 chars):", 
    stripeSecretKey.substring(0, 10) + "..."
  );
  try {
    stripe = new Stripe(stripeSecretKey, { 
      apiVersion: "2025-05-28.basil",
      telemetry: false, 
    });
    console.log("Stripe SDK initialized successfully using STRIPE_SECRET_KEY.");
  } catch (e: any) {
    console.error(
      "CRITICAL_ERROR during Stripe SDK initialization with STRIPE_SECRET_KEY. Error Name:", 
      e.name, 
      "Message:", e.message, 
      "Stack:", e.stack
    );
  }
}

export const createCheckoutSessionCallable = functions.https.onCall(
  async (request: functions.https.CallableRequest<CreateCheckoutSessionData>) => {
    if (!stripe) {
        console.error("Stripe SDK is not available (was not initialized). Cannot process createCheckoutSessionCallable.");
        throw new functions.https.HttpsError("internal", "Stripe SDK is not configured or failed to initialize. Please check server logs.");
    }
    const { priceId, successUrl, cancelUrl, userId: clientUserId } = request.data;

    if (!priceId || !successUrl || !cancelUrl) {
      throw new functions.https.HttpsError("invalid-argument", "Missing required arguments for checkout session.");
    }

    try {
      let customerId: string | undefined;
      const firebaseUIDToUpdate: string | undefined = clientUserId || request.auth?.uid;
      let userEmail: string | undefined = request.auth?.token?.email;

      if (firebaseUIDToUpdate) {
        const userDoc = await admin.firestore().collection("users").doc(firebaseUIDToUpdate).get();
        const userData = userDoc.data();
        userEmail = userEmail || userData?.email;
        customerId = userData?.stripeCustomerId;
        
        if (!customerId){
          const customerCreateParams: Stripe.CustomerCreateParams = { metadata: { firebaseUID: firebaseUIDToUpdate } };
          if (userEmail) customerCreateParams.email = userEmail;
          const customer = await stripe.customers.create(customerCreateParams);
          customerId = customer.id;
          await admin.firestore().collection("users").doc(firebaseUIDToUpdate).update({ stripeCustomerId: customerId });
        }
      } else {
        console.log("No firebaseUIDToUpdate provided for checkout; proceeding without Stripe customer linkage.");
      }

      const sessionCreateParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ["card"],
        mode: "subscription",
        customer: customerId, 
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { ...(firebaseUIDToUpdate && { firebaseUID: firebaseUIDToUpdate }) }
      };
      const session = await stripe.checkout.sessions.create(sessionCreateParams);
      if (!session.id) throw new functions.https.HttpsError("internal", "Failed to create Stripe session ID.");
      return { sessionId: session.id };
    } catch (error: any) {
      console.error("Error in createCheckoutSessionCallable:", error);
      throw new functions.https.HttpsError("internal", error.message || "An internal error occurred while creating the checkout session.");
    }
  }
);

export const stripeWebhookHandler = functions.https.onRequest(
  async (req, res) => {
    if (!stripe) { 
        console.error("Stripe SDK is not available (was not initialized). Cannot process stripeWebhookHandler.");
        res.status(500).send("Stripe SDK is not configured or failed to initialize. Please check server logs.");
        return;
    }
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!stripeWebhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET environment variable is not set. Cannot process webhook.");
      res.status(500).send("Webhook configuration error: Webhook secret not set in environment.");
      return;
    }

    const sigHeader = req.headers["stripe-signature"];
    let event: Stripe.Event;
    try {
      if (!sigHeader) throw new Error("No stripe-signature header found in request.");
      const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
      event = stripe.webhooks.constructEvent((req as any).rawBody, sig!, stripeWebhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).send(`Webhook Error: Signature verification failed. ${err.message}`);
      return;
    }

    try {
      let stripeSubscription: Stripe.Subscription;
      let stripeInvoice: Stripe.Invoice;
      let userSnapshot: FirebaseFirestore.DocumentSnapshot | undefined;
      let updateData: any;

      switch (event.type) {
        case "checkout.session.completed":
          const session = event.data.object as Stripe.Checkout.Session;
          console.log(`Checkout session ${session.id} completed.`);
          const firebaseUID = session.metadata?.firebaseUID;
          
          const sessionCustomerId = (session as any).customer as string | undefined;
          let sessionSubscriptionId: string | undefined;
          const rawSessionSubscription = (session as any).subscription;
          if (typeof rawSessionSubscription === 'string') {
            sessionSubscriptionId = rawSessionSubscription;
          } else if (rawSessionSubscription && typeof rawSessionSubscription.id === 'string') {
            sessionSubscriptionId = rawSessionSubscription.id;
          }

          if (firebaseUID && sessionSubscriptionId && sessionCustomerId) {
            stripeSubscription = await stripe.subscriptions.retrieve(sessionSubscriptionId as string);
            await admin.firestore().collection("users").doc(firebaseUID).update({
              stripeSubscriptionId: stripeSubscription.id,
              stripeCustomerId: sessionCustomerId,
              subscriptionStatus: stripeSubscription.status,
              subscriptionPriceId: (stripeSubscription as any).items.data[0]?.price.id,
              subscriptionCurrentPeriodEnd: admin.firestore.Timestamp.fromMillis((stripeSubscription as any).current_period_end * 1000),
            });
            console.log(`Firestore updated for user ${firebaseUID} with subscription ${stripeSubscription.id}.`);
          } else {
            console.warn("checkout.session.completed: Missing firebaseUID, subscriptionId, or customerId. Cannot update user record.", 
              { firebaseUID, subscriptionId: sessionSubscriptionId, customerId: sessionCustomerId, sessionId: session.id });
          }
          break;

        case "invoice.paid":
          stripeInvoice = event.data.object as Stripe.Invoice;
          console.log(`Invoice ${stripeInvoice.id} paid.`);
          
          let invSubIdForPaid: string | undefined;
          const rawInvSubForPaid = (stripeInvoice as any).subscription;
          if (typeof rawInvSubForPaid === 'string') invSubIdForPaid = rawInvSubForPaid;
          else if (rawInvSubForPaid && typeof rawInvSubForPaid.id === 'string') invSubIdForPaid = rawInvSubForPaid.id;

          let invCustIdForPaid: string | undefined;
          const rawInvCustForPaid = (stripeInvoice as any).customer;
          if (typeof rawInvCustForPaid === 'string') invCustIdForPaid = rawInvCustForPaid;
          else if (rawInvCustForPaid && typeof rawInvCustForPaid.id === 'string') invCustIdForPaid = rawInvCustForPaid.id;

          if (invSubIdForPaid && invCustIdForPaid) {
            stripeSubscription = await stripe.subscriptions.retrieve(invSubIdForPaid);
            userSnapshot = (await admin.firestore().collection("users").where("stripeCustomerId", "==", invCustIdForPaid).limit(1).get()).docs[0];
            if (userSnapshot && userSnapshot.exists) {
              await userSnapshot.ref.update({
                subscriptionStatus: stripeSubscription.status,
                subscriptionCurrentPeriodEnd: admin.firestore.Timestamp.fromMillis((stripeSubscription as any).current_period_end * 1000),
              });
              console.log(`Invoice paid: Firestore updated for user ${userSnapshot.id}.`);
            } else {
              console.warn("invoice.paid: User snapshot not found for customerId:", invCustIdForPaid);
            }
          } else {
            console.warn("invoice.paid: Missing subscriptionId or customerId on invoice.", { invoiceId: stripeInvoice.id });
          }
          break;

        case "invoice.payment_failed":
          stripeInvoice = event.data.object as Stripe.Invoice;
          console.log(`Invoice payment failed for ${stripeInvoice.id}.`);

          let invSubIdForFailed: string | undefined;
          const rawInvSubForFailed = (stripeInvoice as any).subscription;
          if (typeof rawInvSubForFailed === 'string') invSubIdForFailed = rawInvSubForFailed;
          else if (rawInvSubForFailed && typeof rawInvSubForFailed.id === 'string') invSubIdForFailed = rawInvSubForFailed.id;

          let invCustIdForFailed: string | undefined;
          const rawInvCustForFailed = (stripeInvoice as any).customer;
          if (typeof rawInvCustForFailed === 'string') invCustIdForFailed = rawInvCustForFailed;
          else if (rawInvCustForFailed && typeof rawInvCustForFailed.id === 'string') invCustIdForFailed = rawInvCustForFailed.id;

          if (invSubIdForFailed && invCustIdForFailed) {
            stripeSubscription = await stripe.subscriptions.retrieve(invSubIdForFailed);
            userSnapshot = (await admin.firestore().collection("users").where("stripeCustomerId", "==", invCustIdForFailed).limit(1).get()).docs[0];
            if (userSnapshot && userSnapshot.exists) {
              await userSnapshot.ref.update({ subscriptionStatus: stripeSubscription.status });
              console.log(`Invoice payment failed: Firestore status updated for user ${userSnapshot.id}.`);
            } else {
               console.warn("invoice.payment_failed: User snapshot not found for customerId:", invCustIdForFailed);
            }
          } else {
            console.warn("invoice.payment_failed: Missing subscriptionId or customerId on invoice.", { invoiceId: stripeInvoice.id });
          }
          break;

        case "customer.subscription.updated":
          stripeSubscription = event.data.object as Stripe.Subscription;
          console.log(`Subscription ${stripeSubscription.id} updated.`);
          
          let subUpdatedCustId: string | undefined;
          const rawSubUpdatedCust = (stripeSubscription as any).customer;
          if (typeof rawSubUpdatedCust === 'string') subUpdatedCustId = rawSubUpdatedCust;
          else if (rawSubUpdatedCust && typeof rawSubUpdatedCust.id === 'string') subUpdatedCustId = rawSubUpdatedCust.id;

          if (subUpdatedCustId) {
            userSnapshot = (await admin.firestore().collection("users").where("stripeCustomerId", "==", subUpdatedCustId).limit(1).get()).docs[0];
            if (userSnapshot && userSnapshot.exists) {
              updateData = {
                subscriptionStatus: stripeSubscription.status,
                subscriptionPriceId: (stripeSubscription as any).items.data[0]?.price.id,
                subscriptionCurrentPeriodEnd: admin.firestore.Timestamp.fromMillis((stripeSubscription as any).current_period_end * 1000),
              };
              if ((stripeSubscription as any).cancel_at_period_end && (stripeSubscription as any).cancel_at) {
                updateData.subscriptionCancelAtPeriodEnd = true;
                updateData.subscriptionCancellationDate = admin.firestore.Timestamp.fromMillis((stripeSubscription as any).cancel_at * 1000);
              }
              await userSnapshot.ref.update(updateData);
              console.log(`Subscription update: Firestore updated for user ${userSnapshot.id}.`);
            } else {
              console.warn("customer.subscription.updated: User snapshot not found for customerId:", subUpdatedCustId);
            }
          } else {
            console.warn("customer.subscription.updated: Missing customerId on subscription.", { subscriptionId: stripeSubscription.id });
          }
          break;

        case "customer.subscription.deleted":
          stripeSubscription = event.data.object as Stripe.Subscription;
          console.log(`Subscription ${stripeSubscription.id} deleted.`);
          
          let subDeletedCustId: string | undefined;
          const rawSubDeletedCust = (stripeSubscription as any).customer;
          if (typeof rawSubDeletedCust === 'string') subDeletedCustId = rawSubDeletedCust;
          else if (rawSubDeletedCust && typeof rawSubDeletedCust.id === 'string') subDeletedCustId = rawSubDeletedCust.id;

          if (subDeletedCustId) {
            userSnapshot = (await admin.firestore().collection("users").where("stripeCustomerId", "==", subDeletedCustId).limit(1).get()).docs[0];
            if (userSnapshot && userSnapshot.exists) {
              await userSnapshot.ref.update({ subscriptionStatus: stripeSubscription.status }); // Typically 'canceled' or similar
              console.log(`Subscription deleted: Firestore updated for user ${userSnapshot.id}.`);
            } else {
              console.warn("customer.subscription.deleted: User snapshot not found for customerId:", subDeletedCustId);
            }
          } else {
            console.warn("customer.subscription.deleted: Missing customerId on subscription.", { subscriptionId: stripeSubscription.id });
          }
          break;

        default: console.log(`Unhandled event type ${event.type}`);
      }
      res.status(200).send({ received: true });
    } catch (error: any) {
      console.error("Stripe webhook processing error:", error);
      res.status(500).send("Webhook processing error. Check server logs.");
    }
  }
);

// New Callable Function to create a Stripe Customer Portal link
export const createStripePortalLink = functions.https.onCall(
  async (request: functions.https.CallableRequest<CreateStripePortalLinkData>) => {
    if (!stripe) {
      console.error("Stripe SDK is not available. Cannot create portal link.");
      throw new functions.https.HttpsError("internal", "Stripe SDK not configured. Check server logs.");
    }

    if (!request.auth || !request.auth.uid) {
      throw new functions.https.HttpsError("unauthenticated", "User must be authenticated to access the billing portal.");
    }

    const userId = request.auth.uid;
    const { returnUrl } = request.data;

    if (!returnUrl || typeof returnUrl !== 'string') {
        throw new functions.https.HttpsError("invalid-argument", "The function must be called with a valid 'returnUrl' string argument.");
    }

    try {
      const userDoc = await admin.firestore().collection("users").doc(userId).get();
      const userData = userDoc.data();

      if (!userData || !userData.stripeCustomerId) {
        console.error(`User ${userId} does not have a stripeCustomerId.`);
        throw new functions.https.HttpsError("not-found", "Stripe customer ID not found for this user. Cannot open billing portal.");
      }

      const stripeCustomerId = userData.stripeCustomerId;

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl, // URL to redirect to after leaving the portal
      });

      if (!portalSession.url) {
        throw new functions.https.HttpsError("internal", "Failed to create Stripe portal session URL.");
      }
      
      return { portalUrl: portalSession.url };

    } catch (error: any) {
      console.error(`Error creating Stripe portal link for user ${userId}:`, error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError("internal", error.message || "An internal error occurred while creating the customer portal link.");
    }
  }
);
