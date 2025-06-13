// src/app/payment-success/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function PaymentSuccessPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const searchParams = useSearchParams();
  const { user } = useAuth();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');

    if (status !== 'loading') return;

    if (!sessionId) {
      console.error("No session_id found in URL.");
      setErrorMessage("Missing session information. Your payment may have succeeded, but we could not verify it automatically. Please contact support.");
      setStatus('error');
      return;
    }

    const handleSuccess = async () => {
      try {
        const response = await fetch('/api/handle-payment-success', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'An unknown error occurred.');
        }

        console.log("Successfully updated user's subscription tier.");
        // Optional: Trigger a refresh of user profile data if your auth context needs it
        setStatus('success');

      } catch (error: any) {
        console.error("Error in handleSuccess:", error);
        setErrorMessage(error.message || "Failed to update your profile. Please contact support with your payment details.");
        setStatus('error');
      }
    };

    handleSuccess();
  }, [searchParams, status]);

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <div className="mx-auto bg-blue-100 rounded-full p-3 w-fit">
              <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
            </div>
            <CardTitle className="text-2xl md:text-3xl font-bold mt-4">
              Verifying Payment...
            </CardTitle>
            <CardContent className="text-gray-600">
              <p>Please wait while we confirm your payment and upgrade your account. This should only take a moment.</p>
            </CardContent>
          </>
        );
      case 'success':
        return (
          <>
            <div className="mx-auto bg-green-100 rounded-full p-3 w-fit">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-2xl md:text-3xl font-bold mt-4">
              Payment Successful!
            </CardTitle>
            <CardContent className="text-gray-600 space-y-4">
              <p>Thank you! Your account has been upgraded to Premium.</p>
              <p>You now have access to all premium features. You should also receive a confirmation email shortly.</p>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-6">
              <Button asChild className="w-full sm:w-auto">
                <Link href="/dashboard/coach/profile">Go to Your Profile</Link>
              </Button>
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link href="/">Back to Home</Link>
              </Button>
            </CardFooter>
          </>
        );
      case 'error':
        return (
          <>
            <div className="mx-auto bg-red-100 rounded-full p-3 w-fit">
              <AlertTriangle className="h-12 w-12 text-red-500" />
            </div>
            <CardTitle className="text-2xl md:text-3xl font-bold mt-4">
              Verification Failed
            </CardTitle>
            <CardContent className="text-gray-600 space-y-4">
              <p>{errorMessage}</p>
              <p>Please contact our support team for assistance.</p>
            </CardContent>
            <CardFooter className="flex justify-center pt-6">
               <Button asChild className="w-full sm:w-auto">
                 <Link href="/contact-us">Contact Support</Link>
               </Button>
            </CardFooter>
          </>
        );
    }
  };

  return (
    <div className="container mx-auto py-12 px-4 min-h-screen flex flex-col items-center justify-center">
      <Card className="w-full max-w-lg shadow-lg text-center bg-white">
        <CardHeader>
          {renderContent()}
        </CardHeader>
      </Card>
    </div>
  );
}
