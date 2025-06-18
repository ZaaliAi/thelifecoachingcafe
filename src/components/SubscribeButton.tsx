// src/components/SubscribeButton.tsx
'use client';

import { useState } from 'react';
import { getFunctions, httpsCallable, Functions } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import getStripe from '@/lib/stripe';

interface SubscribeButtonProps {
  priceId: string;
  userId: string | null;
  buttonText?: string;
  className?: string;
}

const SubscribeButton: React.FC<SubscribeButtonProps> = ({
  priceId,
  userId,
  buttonText = 'Subscribe',
  className = 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded',
}) => {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!userId) {
      console.error('User not logged in. Cannot create Stripe checkout session.');
      alert('Please log in to subscribe.');
      return;
    }
    if (!priceId) {
      console.error('Price ID is not provided.');
      alert('Subscription plan not selected.');
      return;
    }

    setLoading(true);

    try {
      const createCheckoutSession = httpsCallable(
        functions,
        'createCheckoutSessionCallable'
      );

      console.log(`Creating checkout session for user: ${userId}, price: ${priceId}`);

      const successUrl = `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${window.location.origin}/payment-cancelled`;

      // **FIX:** Changed 'userId' to 'client_reference_id' to correctly pass the user's ID to Stripe.
      const { data }: any = await createCheckoutSession({
        priceId: priceId,
        successUrl: successUrl,
        cancelUrl: cancelUrl,
        client_reference_id: userId, // Correctly pass the user ID for webhook identification
      });

      console.log('Stripe checkout session created:', data);

      if (data.error) {
        console.error(`Error from createCheckoutSession function: ${data.error.message}`);
        alert(`Error: ${data.error.message}`);
        setLoading(false);
        return;
      }

      if (data.sessionId) {
        const stripe = await getStripe();
        if (stripe) {
          const { error } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
          if (error) {
            console.error('Stripe redirectToCheckout error:', error);
            alert(`Error redirecting to Stripe: ${error.message}`);
          }
        } else {
          console.error('Stripe.js has not loaded yet.');
          alert('Error initializing payment system. Please try again.');
        }
      } else {
        console.error('No sessionId returned from createCheckoutSession function.');
        alert('Could not initiate payment. Please try again.');
      }
    } catch (error: any) {
      console.error('Error calling createCheckoutSession function:', error);
      let errorMessage = 'An unexpected error occurred. Please try again.';
      if (error.message) {
        errorMessage = error.message;
      }
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleCheckout} disabled={loading || !userId} className={className}>
      {loading ? 'Processing...' : buttonText}
    </button>
  );
};

export default SubscribeButton;
