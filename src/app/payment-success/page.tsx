// src/app/payment-success/page.tsx
'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from 'lucide-react';

export default function PaymentSuccessPage() {
  useEffect(() => {
    // You could potentially use the session_id from the URL to fetch more details
    // For example: if you need to display specific order information
    // const urlParams = new URLSearchParams(window.location.search);
    // const sessionId = urlParams.get('session_id');
    // if (sessionId) {
    //   console.log("Stripe Checkout Session ID:", sessionId);
    //   // Fetch session details or update UI accordingly
    // }
  }, []);

  return (
    <div className="container mx-auto py-12 px-4 min-h-screen flex flex-col items-center justify-center">
      <Card className="w-full max-w-lg shadow-lg text-center bg-white dark:bg-gray-800">
        <CardHeader>
          <div className="mx-auto bg-green-100 dark:bg-green-700 rounded-full p-3 w-fit">
            <CheckCircle className="h-12 w-12 text-green-500 dark:text-green-300" />
          </div>
          <CardTitle className="text-2xl md:text-3xl font-bold mt-4 text-gray-800 dark:text-white">
            Payment Successful!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-gray-600 dark:text-gray-300 space-y-4">
          <p>
            Thank you for your purchase! Your transaction has been completed successfully.
          </p>
          <p>
            You should receive a confirmation email shortly. If you have any questions,
            please don't hesitate to contact us.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-6">
          <Button asChild className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-white">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/">Back to Home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
