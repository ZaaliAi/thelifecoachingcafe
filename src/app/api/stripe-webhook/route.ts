
import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebaseAdmin';
import Stripe from 'stripe';

// Initialize Stripe with the secret key.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function handleSubscriptionCreation(session: Stripe.Checkout.Session) {
  console.log("Entering handleSubscriptionCreation");
  const userId = session.client_reference_id;
  const stripeCustomerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;

  if (!userId) {
    console.error('Webhook Error: client_reference_id is missing in session.');
    throw new Error('Webhook Error: client_reference_id is missing in session.');
  }
  console.log(`User ID found: ${userId}`);

  const userRef = adminFirestore.collection('users').doc(userId);

  try {
    await userRef.update({
      stripeCustomerId: stripeCustomerId,
      stripeSubscriptionId: stripeSubscriptionId,
      subscriptionTier: 'premium',
      subscriptionStatus: 'active',
    });
    console.log(`Firestore updated successfully for user ${userId}.`);
  } catch (error) {
    console.error(`Error updating Firestore for user ${userId}:`, error);
    throw error; // Rethrow the error to be caught by the main handler
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
      case 'customer.subscription.updated': {
        // ... (rest of the cases)
      }
      // ...
    }
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook event:', error);
    return NextResponse.json({ error: 'Webhook handler failed.', details: error.message }, { status: 500 });
  }
}

async function updateUserSubscriptionStatus(stripeCustomerId: string, newStatus: 'active' | 'cancelled') {
  // ... (rest of the function)
}
