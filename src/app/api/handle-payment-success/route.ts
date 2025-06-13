// src/app/api/handle-payment-success/route.ts
import { NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { adminDb } from '@/lib/firebaseAdmin';
import { firestore } from 'firebase-admin';

async function updateSubscription(userId: string, subscriptionTier: 'free' | 'premium', status: 'active' | 'pending' | 'cancelled') {
  const userRef = adminDb.collection('users').doc(userId);
  return userRef.update({
    subscriptionTier: subscriptionTier,
    subscriptionStatus: status, // e.g., 'active', 'cancelled'
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });
}

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required.' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId as string);

    if (!session) {
      return NextResponse.json({ error: 'Invalid Stripe session ID.' }, { status: 404 });
    }

    const userId = session.client_reference_id;
    if (!userId) {
      throw new Error(`User ID not found in Stripe session: ${sessionId}`);
    }

    // IMPORTANT: Verify the payment was successful
    if (session.payment_status === 'paid') {
      await updateSubscription(userId, 'premium', 'active');
      console.log(`Successfully upgraded user ${userId} to premium.`);
      return NextResponse.json({ success: true, message: "User upgraded to premium." });
    } else {
      // This case might occur if the user is redirected before the payment is fully confirmed.
      // You might want to handle this gracefully, perhaps by telling the user to wait a moment.
      console.warn(`Payment status for session ${sessionId} is not 'paid', it's '${session.payment_status}'.`);
      return NextResponse.json({ error: `Payment not yet confirmed. Current status: ${session.payment_status}` }, { status: 402 });
    }

  } catch (error: any) {
    console.error('Error handling payment success:', error);
    // It's crucial to log the full error, especially if it's a Stripe-related error object
    const errorMessage = error.message || 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to handle payment success.', details: errorMessage }, { status: 500 });
  }
}
