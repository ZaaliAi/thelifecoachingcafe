// src/app/payment-success/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertTriangle } from 'lucide-react';

function PaymentSuccessContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();

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

        console.log("Successfully updated user's subscription tier. Redirecting...");
        setStatus('success');
        
        // Redirect to the coach's profile editing page after a short delay
        setTimeout(() => {
          router.push('/dashboard/coach/profile');
        }, 2000); // 2-second delay to allow user to read the success message

      } catch (error: any) {
        console.error("Error in handleSuccess:", error);
        setErrorMessage(error.message || "Failed to update your profile. Please contact support with your payment details.");
        setStatus('error');
      }
    };

    handleSuccess();
  }, [searchParams, status, router]);

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
              <p>Redirecting you to your enhanced profile now...</p>
            </CardContent>
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
      <Card className="w-full max-w-lg shadow-lg text-center bg-white">
        <CardHeader>
          {renderContent()}
        </CardHeader>
      </Card>
  );
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <div className="container mx-auto py-12 px-4 min-h-screen flex flex-col items-center justify-center">
                <PaymentSuccessContent />
            </div>
        </Suspense>
    )
}
