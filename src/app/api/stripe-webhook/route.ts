
import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebaseAdmin';
import Stripe from 'stripe';

// Initialize Stripe with the secret key.
// By not specifying an apiVersion, the Stripe library will automatically use the
// API version of the incoming webhook event, ensuring compatibility.
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function handleSubscriptionCreation(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id;
  const stripeCustomerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;

  if (!userId) {
    throw new Error('Webhook Error: client_reference_id is missing in session.');
  }

  const userRef = adminFirestore.collection('users').doc(userId);

  await userRef.update({
    stripeCustomerId: stripeCustomerId,
    stripeSubscriptionId: stripeSubscriptionId,
    subscriptionTier: 'premium',
    subscriptionStatus: 'active',
  });

  console.log(`User ${userId} successfully subscribed.`);
}

// This is the endpoint Stripe will send events to.
export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  // Get the webhook secret from your environment variables
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Stripe webhook secret is not set in environment variables.');
    return NextResponse.json({ error: 'Webhook secret is not configured.' }, { status: 500 });
  }

  let event: Stripe.Event;

  // Verify the event came from Stripe and parse it
  try {
    event = stripe.webhooks.constructEvent(payload, signature!, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 });
  }

  // Handle the specific event type
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription') {
            await handleSubscriptionCreation(session);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.cancel_at_period_end) {
          console.log(`Subscription ${subscription.id} is set to be cancelled at the end of the period.`);
          await updateUserSubscriptionStatus(subscription.customer as string, 'cancelled');
        } else {
           await updateUserSubscriptionStatus(subscription.customer as string, 'active');
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Subscription ${subscription.id} has been deleted.`);
        await updateUserSubscriptionStatus(subscription.customer as string, 'cancelled');
        break;
      }
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Error processing webhook event:', error);
    return NextResponse.json({ error: 'Webhook handler failed.', details: error.message }, { status: 500 });
  }
}

async function updateUserSubscriptionStatus(stripeCustomerId: string, newStatus: 'active' | 'cancelled') {
  const usersRef = adminFirestore.collection('users');
  const q = usersRef.where('stripeCustomerId', '==', stripeCustomerId);
  
  const querySnapshot = await q.get();

  if (querySnapshot.empty) {
    console.error(`No user found with Stripe Customer ID: ${stripeCustomerId}`);
    throw new Error(`User with Stripe ID ${stripeCustomerId} not found.`);
  }

  const userDoc = querySnapshot.docs[0];
  const newTier = newStatus === 'cancelled' ? 'free' : 'premium';

  console.log(`Updating user ${userDoc.id} to tier: ${newTier}, status: ${newStatus}`);

  await userDoc.ref.update({
    subscriptionStatus: newStatus,
    subscriptionTier: newTier,
  });
}
