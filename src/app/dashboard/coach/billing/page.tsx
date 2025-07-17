
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard, Zap } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { doc, getDoc } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { loadStripe } from '@stripe/stripe-js';
import { firebaseApp } from '@/lib/firebase';

const createCheckoutSessionCallable = httpsCallable(getFunctions(firebaseApp), 'createCheckoutSessionCallable');

export default function CoachBillingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth(); // Destructure firebaseUser from useAuth

  useEffect(() => {
    const checkUserStatus = async () => {
      if (user?.id) {
        const userDocRef = doc(db, "users", user.id);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const userData = docSnap.data();
          setIsPremium(userData.subscriptionTier === 'premium');
        } else {
            setIsPremium(false);
        }
      } else {
        setIsPremium(false);
      }
    };
    checkUserStatus();
  }, [user]);

  const handleUpgrade = async () => {
    if (!user || !user.id) {
      console.error("User not authenticated for upgrade.");
      toast({ title: "Authentication Error", description: "Please log in again to upgrade.", variant: "destructive" });
      return;
    }
    const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!stripePublishableKey) {
        console.error("Stripe publishable key is not set in environment variables.");
        toast({ title: "Configuration Error", description: "Stripe payments are not configured correctly. Please contact support.", variant: "destructive" });
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    try {
      const functions = getFunctions(firebaseApp);
      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSessionCallable');

      const successUrl = `${window.location.origin}/payment-success?upgrade=true&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${window.location.origin}/dashboard/coach`;

      const result: any = await createCheckoutSession({
        priceId: "price_1RbHz1G028VJJAft7M0DUoUF", // Premium Price ID
        successUrl: successUrl,
        cancelUrl: cancelUrl,
        userId: user.id,
      });

      if (result.data.sessionId) {
        const stripe = await loadStripe(stripePublishableKey);
        if (stripe) {
          const { error: stripeError } = await stripe.redirectToCheckout({ sessionId: result.data.sessionId });
          if (stripeError) {
            console.error("Stripe redirect error:", stripeError);
            toast({ title: "Payment Error", description: stripeError.message || "Could not redirect to Stripe. Please try again.", variant: "destructive" });
          }
        } else {
          console.error("Stripe.js failed to load.");
          toast({ title: "Payment Error", description: "Stripe.js failed to load. Please try again.", variant: "destructive" });
        }
      } else {
        const errorMessage = result.data.error || "Failed to create Stripe session. Please try again.";
        console.error("Failed to create Stripe session:", errorMessage);
        toast({ title: "Upgrade Error", description: errorMessage, variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error calling createCheckoutSessionCallable:", error);
      toast({ title: "Upgrade Error", description: error.message || "An unexpected error occurred. Please try again.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleManageBilling = async () => {
    setIsLoading(true);
    try {
      if (!firebaseUser) { // Check for firebaseUser
        throw new Error("User not authenticated.");
      }
      const token = await firebaseUser.getIdToken(); // Get token from firebaseUser
      const response = await fetch('/api/manage-billing', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to create billing session.');
      }
      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error("Failed to manage billing:", error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (isPremium === null) {
      return (
        <div className="flex justify-center items-center h-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if (isPremium) {
      return (
        <>
          <p className="mb-6">
            You are a premium member. Click below to manage your subscription, view invoices, or update your payment method in the Stripe billing portal.
          </p>
          <Button
            onClick={handleManageBilling}
            disabled={isLoading || !user}
            size="lg"
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Redirecting...</> : 'Manage Billing & Subscription'}
          </Button>
        </>
      );
    }

    return (
      <>
        <p className="mb-6">
          Supercharge your coaching practice. As a Premium Coach, you'll be featured higher in search results, get a verified badge, and unlock advanced analytics.
        </p>
        <Button
          onClick={handleUpgrade}
          disabled={isLoading || !user}
          size="lg"
          className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
        >
          {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Redirecting...</> : <><Zap className="mr-2 h-5 w-5" /> Upgrade to Premium</>}
        </Button>
      </>
    );
  };

  return (
    <Card className="shadow-lg max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <CreditCard className="mr-3 h-7 w-7 text-primary" />
          Billing & Subscription
        </CardTitle>
        <CardDescription>
          {isPremium
            ? "Manage your subscription, payment methods, and view your billing history."
            : "Upgrade to Premium to unlock all features."
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
}
