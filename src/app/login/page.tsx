"use client";

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, LogIn } from 'lucide-react';
import { useAuth } from '@/lib/auth'; // This will use your src/lib/auth.tsx
import { useToast } from '@/hooks/use-toast';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const loginSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(1, 'Password is required.'),
});
type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { user, loading: authLoading } = useAuth(); // user from useAuth() should have role if auth.tsx works
  const router = useRouter();
  const { toast } = useToast();

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    console.log(`[LoginPage] useEffect triggered. authLoading: ${authLoading}, user exists: ${!!user}`);
    if (user) {
      console.log('[LoginPage] User object in useEffect:', JSON.stringify(user, null, 2));
      // Assuming 'user' object from useAuth() (from auth.tsx) already contains the role and name
      console.log(`[LoginPage] User details from context: email=${(user as any).email}, uid=${(user as any).id || (user as any).uid}, role=${(user as any).role}, name=${(user as any).name}`);
    }

    if (!authLoading && user) {
      const redirectUser = () => {
        // The 'user' from useAuth() should already have the role if auth.tsx is working as the previous logs suggest.
        let determinedRole = (user as any).role || 'user'; // Access role directly from the user object from context

        // Override for admin email if necessary, as a safeguard or primary check
        if ((user as any).email === 'hello@thelifecoachingcafe.com') {
          determinedRole = 'admin';
          console.log(`[LoginPage] Role overridden to 'admin' for ${(user as any).email}`);
        }
        
        console.log(`[LoginPage] Conditions met for redirect. User: ${(user as any).email}, Determined Role: ${determinedRole}`);

        let targetPath = '/dashboard/user';
        if (determinedRole === 'admin') {
          targetPath = '/dashboard/admin';
        } else if (determinedRole === 'coach') {
          targetPath = '/dashboard/coach';
          // Optional: Add check here for coach profile completion if needed before redirect
          // const coachProfile = user as any;
          // if (!coachProfile.bio || !coachProfile.specialties) { // Example check
          //   console.log("[LoginPage] Coach profile incomplete, redirecting to /register-coach");
          //   router.push('/register-coach');
          //   return;
          // }
        }
        
        console.log(`[LoginPage] Attempting to redirect to: ${targetPath}`);
        try {
          router.push(targetPath);
          console.log(`[LoginPage] router.push(${targetPath}) called.`);
        } catch (e) {
          console.error(`[LoginPage] Error during router.push(${targetPath}):`, e);
          toast({ title: "Navigation Error", description: "Could not redirect you automatically.", variant: "destructive"});
        }
      };
      redirectUser();
    } else {
      console.log(`[LoginPage] Conditions for redirect NOT MET. authLoading: ${authLoading}, user exists: ${!!user}`);
    }
  }, [user, authLoading, router, toast]);

  const onSubmit: SubmitHandler<LoginFormData> = async (data) => {
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      console.log("[LoginPage] Firebase sign-in successful for:", userCredential.user.email);
      // onAuthStateChanged in AuthProvider (auth.tsx) will handle setting user context.
      // useEffect above will then handle redirection based on the updated user context.
      // No explicit navigation here. setIsLoading will be reset by page unmount or if error.
    } catch (error: any) {
      setIsLoading(false);
      let errorMessage = "Login failed. Please check your credentials.";
      if (error.code === 'auth/user-not-found' || 
          error.code === 'auth/wrong-password' || 
          error.code === 'auth/invalid-credential' ||
          error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email or password. Please try again.";
      } else if (error.code) {
        console.error("[LoginPage] Firebase Login Error:", error.code, error.message);
      } else {
        console.error("[LoginPage] Non-Firebase Login Error:", error.message);
      }
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12 min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!authLoading && user) {
     return (
      <div className="flex items-center justify-center py-12 min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12 min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">Welcome Back!</CardTitle>
          <CardDescription>
            Log in to access your The Life Coaching Cafe account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" {...register('email')} placeholder="you@example.com" className={errors.email ? 'border-destructive' : ''} />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} className={errors.password ? 'border-destructive' : ''} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            
            <Button type="submit" disabled={isLoading} size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Logging In...
                </>
              ) : (
                'Log In'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2">
          <Button variant="link" asChild className="text-sm text-muted-foreground">
            <Link href="/forgot-password">Forgot password?</Link>
          </Button>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Button variant="link" className="p-0 h-auto text-primary" asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

