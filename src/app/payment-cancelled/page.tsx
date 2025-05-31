// src/app/payment-cancelled/page.tsx
'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle } from 'lucide-react';

export default function PaymentCancelledPage() {
  return (
    <div className="container mx-auto py-12 px-4 min-h-screen flex flex-col items-center justify-center">
      <Card className="w-full max-w-lg shadow-lg text-center bg-white dark:bg-gray-800">
        <CardHeader>
          <div className="mx-auto bg-red-100 dark:bg-red-700 rounded-full p-3 w-fit">
            <XCircle className="h-12 w-12 text-red-500 dark:text-red-300" />
          </div>
          <CardTitle className="text-2xl md:text-3xl font-bold mt-4 text-gray-800 dark:text-white">
            Payment Cancelled
          </CardTitle>
        </CardHeader>
        <CardContent className="text-gray-600 dark:text-gray-300 space-y-4">
          <p>
            Your payment process was cancelled. You have not been charged.
          </p>
          <p>
            If you encountered any issues or have questions, please feel free to contact us.
            You can also try the checkout process again.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-6">
          <Button asChild className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href="/pricing">View Pricing Plans</Link> 
          </Button>
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/">Back to Home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
