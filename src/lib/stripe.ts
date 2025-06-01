// src/lib/stripe.ts
import { loadStripe, Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

const getStripe = (): Promise<Stripe | null> => {
  if (!stripePromise) {
    const stripePublicKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!stripePublicKey) {
      console.error('Stripe public key is not set. Please set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable.');
      return Promise.resolve(null); // Or throw an error
    }
    stripePromise = loadStripe(stripePublicKey);
  }
  return stripePromise;
};

export default getStripe;
