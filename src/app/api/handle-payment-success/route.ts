
import { NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebaseAdmin';

// This function checks if a user's subscription is active.
async function verifySubscription(userId: string): Promise<boolean> {
  const userRef = adminFirestore.collection('users').doc(userId);
  const doc = await userRef.get();

  if (!doc.exists) {
    console.error(`User with ID ${userId} not found.`);
    return false;
  }
  
  const userData = doc.data();
  // Check that the subscription is marked as active in your database.
  // This status should be reliably set by your Stripe webhook.
  return userData?.subscriptionStatus === 'active' && userData?.subscriptionTier === 'premium';
}

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
        return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // The client_reference_id set during checkout is the user's ID.
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
        headers: {
            'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`
        }
    });

    const session = await response.json();
    const userId = session.client_reference_id;

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found in session' }, { status: 400 });
    }
    
    // Instead of updating the subscription here, we now POLL for the updated status.
    // The webhook is the single source of truth for subscription status.
    const isSubscribed = await verifySubscription(userId);

    if (isSubscribed) {
      return NextResponse.json({ success: true, message: "Subscription verified." });
    } else {
      // If the webhook hasn't processed yet, the status might not be active.
      // The client should handle this and can retry.
      return NextResponse.json({ success: false, error: "Subscription not active. Please wait a moment and try again." }, { status: 409 }); // 409 Conflict
    }

  } catch (error: any) {
    console.error('Error verifying payment success:', error);
    return NextResponse.json({ error: 'Failed to verify payment success.', details: error.message }, { status: 500 });
  }
}
