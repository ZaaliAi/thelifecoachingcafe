
import { NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebaseAdmin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-04-10',
});

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'You must be logged in to manage billing.' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const userDoc = await adminFirestore.collection('users').doc(userId).get();
    const userData = userDoc.data();
    if (!userData || !userData.stripeCustomerId) {
      throw new Error('Stripe Customer ID not found for this user.');
    }

    const stripeCustomerId = userData.stripeCustomerId;

    const returnUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/coach/settings` : 'https://thelifecoachingcafe.com/dashboard/coach/settings';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: portalSession.url });

  } catch (error: any) {
    console.error('Error creating Stripe customer portal session:', error);
    const errorMessage = error.message || 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to create billing session.', details: errorMessage }, { status: 500 });
  }
}
