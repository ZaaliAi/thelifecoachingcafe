
"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';

export default function CoachBillingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { firebaseUser } = useAuth(); // <-- USE FIREBASEUSER

  const handleManageBilling = async () => {
    setIsLoading(true);

    if (!firebaseUser) { // <-- CHECK FIREBASEUSER
      toast({ title: "Not Authenticated", description: "Please log in to manage your billing.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    try {
      const token = await firebaseUser.getIdToken(); // <-- USE FIREBASEUSER

      const response = await fetch('/api/manage-billing', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to create billing session.');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error("Failed to manage billing:", error);
      toast({
        title: "Error",
        description: error.message || "Could not access the billing portal. Please try again later.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <CreditCard className="mr-3 h-7 w-7 text-primary" />
          Billing & Subscription
        </CardTitle>
        <CardDescription>
          Manage your subscription, payment methods, and view your billing history.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-6">
          Click the button below to be securely redirected to our payment provider, Stripe,
          where you can manage all aspects of your subscription.
        </p>
        <Button
          onClick={handleManageBilling}
          disabled={isLoading || !firebaseUser} // <-- USE FIREBASEUSER
          size="lg"
          className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Redirecting...
            </>
          ) : (
            <>Manage Billing & Subscription</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
