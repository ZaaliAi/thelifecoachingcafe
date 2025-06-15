
'use client';

import Link from 'next/link';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, AlertTriangle } from 'lucide-react';

const MAX_RETRIES = 5; // Poll the API up to 5 times
const RETRY_INTERVAL = 2000; // 2 seconds between each poll

function PaymentSuccessContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    let retries = 0;

    if (!sessionId) {
        setErrorMessage("Missing session information. Your payment may have succeeded, but we could not verify it automatically.");
        setStatus('error');
        return;
    }

    const verifyPayment = async () => {
      try {
        const response = await fetch('/api/handle-payment-success', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setStatus('success');
          setTimeout(() => router.push('/dashboard/coach/profile'), 2000);
        } else if (retries < MAX_RETRIES) {
          retries++;
          setTimeout(verifyPayment, RETRY_INTERVAL);
        } else {
            setErrorMessage(data.error || "Verification timed out. Please check your dashboard or contact support.");
            setStatus('error');
        }
      } catch (error: any) {
        setErrorMessage("An unexpected error occurred. Please contact support.");
        setStatus('error');
      }
    };

    verifyPayment();
  }, [searchParams, router]);

  const renderContent = () => {
    switch (status) {
        case 'loading':
            return (
                <>
                    <div className="mx-auto bg-blue-100 rounded-full p-3 w-fit">
                        <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                    </div>
                    <CardTitle className="text-2xl md:text-3xl font-bold mt-4">
                        Finalizing Your Subscription...
                    </CardTitle>
                    <CardContent className="text-gray-600">
                        <p>Please wait while we confirm your payment. This may take a few seconds.</p>
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
                        Subscription Confirmed!
                    </CardTitle>
                    <CardContent className="text-gray-600">
                        <p>Your account is now Premium! Redirecting you to your profile...</p>
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
                    <CardContent className="text-gray-600">
                        <p>{errorMessage}</p>
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
    );
}
