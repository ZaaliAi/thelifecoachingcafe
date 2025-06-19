
import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebaseAdmin';
import Stripe from 'stripe';

// Initialize Stripe with the secret key.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function handleSubscriptionCreation(session: Stripe.Checkout.Session) {
  console.log("Entering handleSubscriptionCreation for session:", session.id);
  const userId = session.client_reference_id;
  const stripeCustomerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;

  if (!userId) {
    console.error('Webhook Error: client_reference_id is missing in session.');
    throw new Error('Webhook Error: client_reference_id is missing in session.');
  }
  console.log(`Processing subscription for user ID: ${userId}`);

  const userRef = adminFirestore.collection('users').doc(userId);

  try {
    await userRef.update({
      stripeCustomerId: stripeCustomerId,
      stripeSubscriptionId: stripeSubscriptionId,
      subscriptionTier: 'premium',
      subscriptionStatus: 'active',
    });
    console.log(`Firestore updated successfully for new premium user ${userId}.`);
  } catch (error) {
    console.error(`Error updating Firestore for user ${userId}:`, error);
    throw error;
  }
}

async function handleSubscriptionCancellation(subscription: Stripe.Subscription) {
  console.log("Entering handleSubscriptionCancellation for subscription:", subscription.id);
  const stripeSubscriptionId = subscription.id;

  // Find the user with the matching subscription ID
  const usersRef = adminFirestore.collection('users');
  const userQuery = usersRef.where('stripeSubscriptionId', '==', stripeSubscriptionId);
  
  const querySnapshot = await userQuery.get();

  if (querySnapshot.empty) {
    console.error(`Webhook Error: No user found with subscription ID: ${stripeSubscriptionId}`);
    // It's important not to throw an error here, as Stripe might be sending an event
    // for a subscription that was created but the user creation failed.
    // We log the error and return gracefully.
    return;
  }

  // There should only be one user per subscription ID.
  const userDoc = querySnapshot.docs[0];
  const userId = userDoc.id;
  console.log(`Found user ${userId} for subscription cancellation.`);

  const userRef = adminFirestore.collection('users').doc(userId);

  try {
    // Downgrade the user to the free 'coach' role.
    await userRef.update({
      subscriptionTier: 'free',
      subscriptionStatus: 'cancelled',
      // Optionally, you might want to nullify the subscription ID
      // stripeSubscriptionId: null, 
    });
    console.log(`User ${userId} has been successfully downgraded to the free plan.`);
  } catch (error) {
    console.error(`Error downgrading user ${userId} in Firestore:`, error);
    throw error;
  }
}

// This is the endpoint Stripe will send events to.
export async function POST(request: Request) {
  console.log("Stripe webhook POST request received.");
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Stripe webhook secret is not set in environment variables.');
    return NextResponse.json({ error: 'Webhook secret is not configured.' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature!, webhookSecret);
    console.log(`Stripe event constructed successfully: ${event.id}, type: ${event.type}`);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }

  // Handle the specific event type
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        console.log("Processing checkout.session.completed event.");
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription') {
            await handleSubscriptionCreation(session);
        } else {
            console.log("Event was a one-time payment, not a subscription. Skipping.");
        }
        break;
      }
      case 'customer.subscription.deleted': {
        console.log("Processing customer.subscription.deleted event.");
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCancellation(subscription);
        break;
      }
      // You might also want to handle customer.subscription.updated
      // for cases where a subscription is set to cancel at period end.
      case 'customer.subscription.updated': {
        console.log("Processing customer.subscription.updated event.");
        const subscription = event.data.object as Stripe.Subscription;
        // If the subscription is set to cancel at the end of the period,
        // you could update the user's status to 'pending_cancellation'.
        if (subscription.cancel_at_period_end) {
            console.log(`Subscription ${subscription.id} is pending cancellation.`);
            // Implement logic here if you want to notify the user or update their status.
        }
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook event:', error);
    return NextResponse.json({ error: 'Webhook handler failed.', details: error.message }, { status: 500 });
  }
}
