
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard, Zap } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { doc, getDoc } from "firebase/firestore";
import { db } from '@/lib/firebase'; // Ensure you have a 'db' export from your firebase config
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

const createCheckoutSessionCallable = httpsCallable(functions, 'createCheckoutSessionCallable');

export default function CoachBillingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isPremium, setIsPremium] = useState<boolean | null>(null); // null for loading state
  const { toast } = useToast();
  const { user } = useAuth(); // Using the user object from your auth context

  useEffect(() => {
    // Check user's subscription status from Firestore
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
    setIsLoading(true);
    try {
        const result: any = await createCheckoutSessionCallable({ returnUrl: window.location.href });
        window.location.href = result.data.url;
    } catch (error: any) {
        console.error("Error creating checkout session:", error);
        toast({ title: "Error", description: "Could not initiate upgrade. Please try again.", variant: "destructive" });
        setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setIsLoading(true);
    try {
      if (!user?.firebaseUser) {
        throw new Error("User not authenticated.");
      }
      const token = await user.firebaseUser.getIdToken();
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
