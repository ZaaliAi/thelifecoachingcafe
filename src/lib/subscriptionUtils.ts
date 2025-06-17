import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';
import { loadStripe, type StripeError } from '@stripe/stripe-js'; // Ensure StripeError is imported
import { firebaseApp } from '@/lib/firebase';
import type { User } from '@/lib/auth'; // Assuming User type from auth has at least 'id'

interface InitiateCheckoutOptions {
  priceId: string;
  user: User; // Or a more specific type like { id: string }
  successUrl?: string;
  cancelUrl?: string;
}

export const initiateStripeCheckout = async ({
  priceId,
  user,
  successUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/payment-success?upgrade=true&session_id={CHECKOUT_SESSION_ID}`,
  cancelUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/coach`, // Default to coach dashboard on cancel
}: InitiateCheckoutOptions): Promise<{ error?: string; stripeError?: StripeError } | void> => { // void if redirect happens
  if (typeof window === 'undefined') {
    // Cannot proceed with window.location.origin on server side
    return { error: "Stripe checkout must be initiated from the client-side." };
  }
  if (!user || !user.id) {
    console.error("initiateStripeCheckout: User not authenticated.");
    return { error: "User not authenticated." };
  }

  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!stripePublishableKey) {
    console.error("initiateStripeCheckout: Stripe publishable key is not set.");
    return { error: "Stripe payments are not configured correctly. Please contact support." };
  }

  try {
    const functionsInstance: Functions = getFunctions(firebaseApp);
    const createCheckoutSession = httpsCallable(functionsInstance, 'createCheckoutSessionCallable');

    console.log(`initiateStripeCheckout: Calling createCheckoutSessionCallable for user ${user.id} with priceId ${priceId}`);
    const result: any = await createCheckoutSession({
      priceId: priceId,
      successUrl: successUrl,
      cancelUrl: cancelUrl,
      userId: user.id,
    });

    if (result.data.error) {
      console.error("initiateStripeCheckout: Error from createCheckoutSessionCallable:", result.data.error);
      return { error: result.data.error.message || "Failed to create Stripe session due to server error." };
    }

    if (result.data.sessionId) {
      console.log("initiateStripeCheckout: Session ID received. Loading Stripe.js...");
      const stripe = await loadStripe(stripePublishableKey);
      if (stripe) {
        console.log("initiateStripeCheckout: Stripe.js loaded. Redirecting to checkout...");
        const { error: stripeRedirectError } = await stripe.redirectToCheckout({ sessionId: result.data.sessionId });
        if (stripeRedirectError) {
          console.error("initiateStripeCheckout: Stripe redirect error:", stripeRedirectError);
          return { stripeError: stripeRedirectError };
        }
        // If redirectToCheckout is successful, it navigates away.
        // No explicit success return needed here as the function will not complete past this point on success.
        return; // void return
      } else {
        console.error("initiateStripeCheckout: Stripe.js failed to load.");
        return { error: "Stripe.js failed to load. Please try again." };
      }
    }
    console.error("initiateStripeCheckout: No sessionId returned from createCheckoutSessionCallable.");
    return { error: "No sessionId returned from createCheckoutSessionCallable. Please try again." };
  } catch (error: any) {
    console.error("initiateStripeCheckout: Catch-all error:", error);
    // Check if error is from Firebase Functions httpsCallable
    if (error.code && error.message) { // FirebaseError has code and message
        return { error: `Function call failed: ${error.code} - ${error.message}` };
    }
    return { error: error.message || "An unexpected error occurred during checkout initiation." };
  }
};
