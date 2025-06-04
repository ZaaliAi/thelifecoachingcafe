import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";

if (!admin.apps.length) {
  admin.initializeApp();
  console.log('Firebase Admin SDK initialized in stripe.ts');
} else {
  console.log('Firebase Admin SDK already initialized (stripe.ts)');
}

interface CreateCheckoutSessionData {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId?: string;
}

interface CreateStripePortalLinkData {
  returnUrl: string;
}

// Use functions.config() to access environment configuration set by `firebase functions:config:set`
const stripeSecretKey = process.env.STRIPE_SECRETKEY; // MODIFIED
const stripeWebhookSecret = process.env.STRIPE_WEBHOOKSECRET; // MODIFIED

let stripe: Stripe | undefined;

if (!stripeSecretKey) {
  console.error(
    'CRITICAL_ERROR: STRIPE_SECRETKEY is not configured in environment variables. Stripe functions WILL FAIL.' // MODIFIED
  );
} else {
  try {
    stripe = new Stripe(stripeSecretKey, { 
      apiVersion: "2024-04-10", 
      telemetry: false, 
    });
    console.log('Stripe SDK initialized successfully.');
  } catch (e: any) {
    console.error('CRITICAL_ERROR during Stripe SDK initialization:', e);
  }
}

export const createCheckoutSessionCallable = functions.https.onCall(
  async (request: CallableRequest<CreateCheckoutSessionData>) => {
    if (!stripe) {
        console.error('Stripe SDK is not available. Cannot process createCheckoutSessionCallable.');
        throw new HttpsError('internal', 'Stripe SDK not configured or failed to initialize. Check server logs.');
    }
    const { priceId, successUrl, cancelUrl, userId: clientUserId } = request.data;

    if (!priceId || !successUrl || !cancelUrl) {
      throw new HttpsError('invalid-argument', 'Missing required arguments.');
    }

    try {
      let customerId: string | undefined;
      const firebaseUIDToUpdate: string | undefined = clientUserId || request.auth?.uid;
      let userEmail: string | undefined = request.auth?.token?.email;

      if (firebaseUIDToUpdate) {
        const userDoc = await admin.firestore().collection('users').doc(firebaseUIDToUpdate).get();
        const userData = userDoc.data();
        userEmail = userEmail || userData?.email;
        customerId = userData?.stripeCustomerId;
        
        if (!customerId){
          const customerCreateParams: Stripe.CustomerCreateParams = { metadata: { firebaseUID: firebaseUIDToUpdate } };
          if (userEmail) customerCreateParams.email = userEmail;
          const customer = await stripe.customers.create(customerCreateParams);
          customerId = customer.id;
          await admin.firestore().collection('users').doc(firebaseUIDToUpdate).update({ 
            stripeCustomerId: customerId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp() 
          });
        }
      } else {
        console.log('No firebaseUID provided for checkout; proceeding without Stripe customer linkage.');
      }

      const sessionCreateParams: Stripe.Checkout.SessionCreateParams = {
        payment_method_types: ['card'],
        mode: 'subscription',
        customer: customerId, 
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { ...(firebaseUIDToUpdate && { firebaseUID: firebaseUIDToUpdate }) }
      };
      const session = await stripe.checkout.sessions.create(sessionCreateParams);
      if (!session.id) throw new HttpsError('internal', 'Failed to create Stripe session ID.');
      return { sessionId: session.id };
    } catch (error: any) {
      console.error('Error in createCheckoutSessionCallable:', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Internal error creating checkout.');
    }
  }
);

export const stripeWebhookHandler = functions.https.onRequest(
  async (req, res) => {
    if (!stripe) { 
        console.error('Stripe SDK not available. Cannot process stripeWebhookHandler.');
        res.status(500).send('Stripe SDK not configured or failed to initialize. Check server logs.');
        return;
    }
    if (!stripeWebhookSecret) {
      console.error('CRITICAL_ERROR: STRIPE_WEBHOOKSECRET not configured in Firebase Functions config. Webhook will fail. Run: firebase functions:config:set stripe.webhooksecret="YOUR_KEY"'); // MODIFIED
      res.status(500).send('Webhook config error: Secret not set on server.');
      return;
    }

    const sigHeader = req.headers['stripe-signature'];
    let event: Stripe.Event;
    try {
      if (!sigHeader) throw new Error('No stripe-signature header.');
      const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;
      if (!(req as any).rawBody) {
        console.error('Webhook Error: req.rawBody is not available. Ensure body parser is not consuming it before verification or is configured to preserve it.');
        throw new Error('Missing rawBody for webhook verification.');
      }
      event = stripe.webhooks.constructEvent((req as any).rawBody, sig!, stripeWebhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      res.status(400).send('Webhook Error: Signature verification failed. ' + err.message);
      return;
    }

    try {
      let stripeSubscription: Stripe.Subscription;
      let stripeInvoice: Stripe.Invoice;
      let userSnapshot: FirebaseFirestore.DocumentSnapshot | undefined;

      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object as Stripe.Checkout.Session;
          console.log('Checkout session ' + session.id + ' completed.');
          const firebaseUID = session.metadata?.firebaseUID;
          
          let sessionCustomerId: string | undefined;
          if (typeof session.customer === 'string') {
            sessionCustomerId = session.customer;
          } else if (session.customer && typeof session.customer.id === 'string') {
            sessionCustomerId = session.customer.id;
          }

          let sessionSubscriptionId: string | undefined;
          if (typeof session.subscription === 'string') {
            sessionSubscriptionId = session.subscription;
          } else if (session.subscription && typeof (session.subscription as Stripe.Subscription).id === 'string') {
            sessionSubscriptionId = (session.subscription as Stripe.Subscription).id;
          }

          if (firebaseUID && sessionSubscriptionId && sessionCustomerId) {
            stripeSubscription = await stripe.subscriptions.retrieve(sessionSubscriptionId);
            const priceIdFromSubscription = stripeSubscription.items.data[0]?.price.id;

            const updateDataForCheckout: any = {
              stripeSubscriptionId: stripeSubscription.id,
              stripeCustomerId: sessionCustomerId,
              subscriptionStatus: stripeSubscription.status,
              subscriptionPriceId: priceIdFromSubscription,
              subscriptionCurrentPeriodEnd: admin.firestore.Timestamp.fromMillis(stripeSubscription.current_period_end * 1000),
              updatedAt: admin.firestore.FieldValue.serverTimestamp() 
            };

            if (priceIdFromSubscription === "price_1RURVlG6UVJU45QN1mByj8Fc") { // Your PREMIUM Price ID
              updateDataForCheckout.subscriptionTier = 'premium';
              console.log('Premium subscription (price: ' + priceIdFromSubscription + ') for user ' + firebaseUID + '. Tier: premium.');
            } else {
              updateDataForCheckout.subscriptionTier = 'free'; 
              console.log('Non-premium subscription (price: ' + priceIdFromSubscription + ') for user ' + firebaseUID + '. Tier: free.');
            }

            await admin.firestore().collection('users').doc(firebaseUID).update(updateDataForCheckout);
            console.log('Firestore updated for user ' + firebaseUID + ', subscription ' + stripeSubscription.id + '. Tier: ' + updateDataForCheckout.subscriptionTier + '.');
          } else {
            console.warn('checkout.session.completed: Missing data. Cannot update user.', 
              { firebaseUID, subscriptionId: sessionSubscriptionId, customerId: sessionCustomerId, sessionId: session.id });
          }
          break;

        case 'invoice.paid':
          stripeInvoice = event.data.object as Stripe.Invoice;
          console.log('Invoice ' + stripeInvoice.id + ' paid.');
          
          let invSubIdForPaid: string | undefined;
          if (typeof stripeInvoice.subscription === 'string') invSubIdForPaid = stripeInvoice.subscription;
          else if (stripeInvoice.subscription && typeof (stripeInvoice.subscription as Stripe.Subscription).id === 'string') invSubIdForPaid = (stripeInvoice.subscription as Stripe.Subscription).id;

          let invCustIdForPaid: string | undefined;
          if (typeof stripeInvoice.customer === 'string') invCustIdForPaid = stripeInvoice.customer;
          else if (stripeInvoice.customer && typeof (stripeInvoice.customer as Stripe.Customer).id === 'string') invCustIdForPaid = (stripeInvoice.customer as Stripe.Customer).id;

          if (invSubIdForPaid && invCustIdForPaid) {
            stripeSubscription = await stripe.subscriptions.retrieve(invSubIdForPaid);
            userSnapshot = (await admin.firestore().collection('users').where('stripeCustomerId', '==', invCustIdForPaid).limit(1).get()).docs[0];
            if (userSnapshot && userSnapshot.exists) {
              const updateDataForInvoicePaid: any = {
                subscriptionStatus: stripeSubscription.status,
                subscriptionCurrentPeriodEnd: admin.firestore.Timestamp.fromMillis(stripeSubscription.current_period_end * 1000),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              };
              const priceIdFromSub = stripeSubscription.items.data[0]?.price.id;
              if (priceIdFromSub === "price_1RURVlG6UVJU45QN1mByj8Fc") {
                updateDataForInvoicePaid.subscriptionTier = 'premium';
              } else if (priceIdFromSub) {
                updateDataForInvoicePaid.subscriptionTier = 'free';
              }
              await userSnapshot.ref.update(updateDataForInvoicePaid);
              console.log('Invoice paid: Firestore updated for user ' + userSnapshot.id + '.');
            } else {
              console.warn('invoice.paid: User not found for customerId:', invCustIdForPaid);
            }
          } else {
            console.warn('invoice.paid: Missing subscriptionId or customerId.', { invoiceId: stripeInvoice.id });
          }
          break;

        case 'invoice.payment_failed':
          stripeInvoice = event.data.object as Stripe.Invoice;
          console.log('Invoice payment failed for ' + stripeInvoice.id + '.');

          let invSubIdForFailed: string | undefined;
          if (typeof stripeInvoice.subscription === 'string') invSubIdForFailed = stripeInvoice.subscription;
          else if (stripeInvoice.subscription && typeof (stripeInvoice.subscription as Stripe.Subscription).id === 'string') invSubIdForFailed = (stripeInvoice.subscription as Stripe.Subscription).id;

          let invCustIdForFailed: string | undefined;
          if (typeof stripeInvoice.customer === 'string') invCustIdForFailed = stripeInvoice.customer;
          else if (stripeInvoice.customer && typeof (stripeInvoice.customer as Stripe.Customer).id === 'string') invCustIdForFailed = (stripeInvoice.customer as Stripe.Customer).id;

          if (invSubIdForFailed && invCustIdForFailed) {
            stripeSubscription = await stripe.subscriptions.retrieve(invSubIdForFailed);
            userSnapshot = (await admin.firestore().collection('users').where('stripeCustomerId', '==', invCustIdForFailed).limit(1).get()).docs[0];
            if (userSnapshot && userSnapshot.exists) {
              const updateDataForPaymentFailure: any = { 
                subscriptionStatus: stripeSubscription.status,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              };
              if (stripeSubscription.status === 'canceled' || stripeSubscription.status === 'unpaid') {
                 updateDataForPaymentFailure.subscriptionTier = 'free';
              }
              await userSnapshot.ref.update(updateDataForPaymentFailure);
              console.log('Invoice payment failed: Firestore updated for user ' + userSnapshot.id + '. Tier: ' + (updateDataForPaymentFailure.subscriptionTier || userSnapshot.data()?.subscriptionTier) + '.');
            } else {
               console.warn('invoice.payment_failed: User not found for customerId:', invCustIdForFailed);
            }
          } else {
            console.warn('invoice.payment_failed: Missing subscriptionId or customerId.', { invoiceId: stripeInvoice.id });
          }
          break;

        case 'customer.subscription.updated':
          stripeSubscription = event.data.object as Stripe.Subscription;
          console.log('Subscription ' + stripeSubscription.id + ' updated.');
          
          let subUpdatedCustId: string | undefined;
          if (typeof stripeSubscription.customer === 'string') subUpdatedCustId = stripeSubscription.customer;
          else if (stripeSubscription.customer && typeof (stripeSubscription.customer as Stripe.Customer).id === 'string') subUpdatedCustId = (stripeSubscription.customer as Stripe.Customer).id;

          if (subUpdatedCustId) {
            userSnapshot = (await admin.firestore().collection('users').where('stripeCustomerId', '==', subUpdatedCustId).limit(1).get()).docs[0];
            if (userSnapshot && userSnapshot.exists) {
              const updateDataForSubUpdate: any = {
                subscriptionStatus: stripeSubscription.status,
                subscriptionPriceId: stripeSubscription.items.data[0]?.price.id,
                subscriptionCurrentPeriodEnd: admin.firestore.Timestamp.fromMillis(stripeSubscription.current_period_end * 1000),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              };
              if (stripeSubscription.cancel_at_period_end && stripeSubscription.cancel_at) {
                updateDataForSubUpdate.subscriptionCancelAtPeriodEnd = true;
                updateDataForSubUpdate.subscriptionCancellationDate = admin.firestore.Timestamp.fromMillis(stripeSubscription.cancel_at * 1000);
              } else {
                 updateDataForSubUpdate.subscriptionCancelAtPeriodEnd = false; 
              }
              
              const currentPriceId = stripeSubscription.items.data[0]?.price.id;
              if (currentPriceId === "price_1RURVlG6UVJU45QN1mByj8Fc") {
                updateDataForSubUpdate.subscriptionTier = 'premium';
              } else if (currentPriceId) {
                updateDataForSubUpdate.subscriptionTier = 'free';
              }
              if (stripeSubscription.status === 'canceled') {
                updateDataForSubUpdate.subscriptionTier = 'free';
              }

              await userSnapshot.ref.update(updateDataForSubUpdate);
              console.log('Subscription update: Firestore updated for user ' + userSnapshot.id + '. Tier: ' + updateDataForSubUpdate.subscriptionTier + '.');
            } else {
              console.warn('customer.subscription.updated: User not found for customerId:', subUpdatedCustId);
            }
          } else {
            console.warn('customer.subscription.updated: Missing customerId.', { subscriptionId: stripeSubscription.id });
          }
          break;

        case 'customer.subscription.deleted':
          stripeSubscription = event.data.object as Stripe.Subscription;
          console.log('Subscription ' + stripeSubscription.id + ' deleted.');
          
          let subDeletedCustId: string | undefined;
          if (typeof stripeSubscription.customer === 'string') subDeletedCustId = stripeSubscription.customer;
          else if (stripeSubscription.customer && typeof (stripeSubscription.customer as Stripe.Customer).id === 'string') subDeletedCustId = (stripeSubscription.customer as Stripe.Customer).id;

          if (subDeletedCustId) {
            userSnapshot = (await admin.firestore().collection('users').where('stripeCustomerId', '==', subDeletedCustId).limit(1).get()).docs[0];
            if (userSnapshot && userSnapshot.exists) {
              await userSnapshot.ref.update({ 
                subscriptionStatus: stripeSubscription.status,
                subscriptionTier: 'free',
                stripeSubscriptionId: null,
                subscriptionPriceId: null,
                subscriptionCurrentPeriodEnd: null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              console.log('Subscription deleted: Firestore updated for user ' + userSnapshot.id + '. Tier: free.');
            } else {
              console.warn('customer.subscription.deleted: User not found for customerId:', subDeletedCustId);
            }
          } else {
            console.warn('customer.subscription.deleted: Missing customerId.', { subscriptionId: stripeSubscription.id });
          }
          break;

        default: console.log('Unhandled event type ' + event.type);
      }
      res.status(200).send({ received: true });
    } catch (error: any) {
      console.error('Stripe webhook processing error:', error);
      res.status(500).send('Webhook processing error. Check server logs.');
    }
  }
);

export const createStripePortalLink = functions.https.onCall(
  async (request: CallableRequest<CreateStripePortalLinkData>) => {
    if (!stripe) {
      console.error('Stripe SDK not available. Cannot create portal link.');
      throw new HttpsError('internal', 'Stripe SDK not configured or failed to initialize. Check server logs.');
    }

    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'User must be authenticated.');
    }

    const userId = request.auth.uid;
    const { returnUrl } = request.data;

    if (!returnUrl || typeof returnUrl !== 'string') {
        throw new HttpsError('invalid-argument', "Valid 'returnUrl' is required."); 
    }

    try {
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();

      if (!userData || !userData.stripeCustomerId) {
        console.error('User ' + userId + ' has no stripeCustomerId.');
        throw new HttpsError('not-found', 'Stripe customer ID not found.');
      }

      const stripeCustomerId = userData.stripeCustomerId;
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });

      if (!portalSession.url) {
        throw new HttpsError('internal', 'Failed to create Stripe portal session URL.');
      }
      
      return { portalUrl: portalSession.url };

    } catch (error: any) {
      console.error('Error creating Stripe portal link for user ' + userId + ':', error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', error.message || 'Internal error creating portal link.');
    }
  }
);
