
'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Zap } from 'lucide-react';

export default function PaymentSuccessPage() {
  const router = useRouter();

  // Automatically redirect the user after a few seconds.
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/dashboard/coach/profile');
    }, 4000); // 4-second delay before redirecting

    // Cleanup the timer if the component is unmounted
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="container mx-auto py-12 px-4 min-h-screen flex flex-col items-center justify-center">
      <Card className="w-full max-w-lg shadow-xl text-center bg-white animate-fade-in-up">
        <CardHeader>
          <div className="mx-auto bg-green-100 rounded-full p-4 w-fit">
            <CheckCircle className="h-16 w-16 text-green-600" />
          </div>
          <CardTitle className="text-3xl md:text-4xl font-bold mt-6 text-gray-800">
            Upgrade Successful!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-gray-600 text-lg px-8">
          <p>
            Congratulations! Your account is now <span className="font-semibold text-primary">Premium</span>.
            You can now access all exclusive features.
          </p>
          <p className="mt-4">
            We are redirecting you to your profile editor so you can start enhancing your profile right away.
          </p>
        </CardContent>
        <CardFooter className="flex flex-col items-center justify-center pt-8 gap-4">
          <Button asChild size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href="/dashboard/coach/profile">
              <Zap className="mr-2 h-5 w-5" />
              Go to My Profile Now
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            If you are not redirected automatically, please click the button above.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
