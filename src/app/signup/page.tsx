"use client";

import { useState, useEffect, Suspense } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form'; // Removed Controller
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Removed useSearchParams
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Removed RadioGroup, RadioGroupItem imports
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth'; 
import { useToast } from '@/hooks/use-toast';

// Updated schema: removed role
const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// SignupFormData type will be inferred from the updated schema
type SignupFormData = z.infer<typeof signupSchema>;

function SignupFormContent() {
  const [isLoading, setIsLoading] = useState(false);
  const { user, loading: authLoading, registerWithEmailAndPassword } = useAuth(); 
  const router = useRouter();
  const { toast } = useToast();
  // Removed searchParams and initialRole logic

  const { register, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      // Removed role from defaultValues
      name: '',
      email: '',
    }
  });

  // Removed useEffect for setting initialRole

  useEffect(() => {
    if (!authLoading && user) {
      // Redirect if user is already logged in and on signup page
      if (!router.pathname?.includes('/dashboard')) {
        router.push('/dashboard/user'); // Default to user dashboard
      }
    }
  }, [user, authLoading, router]);

  const onSubmit: SubmitHandler<SignupFormData> = async (data) => {
    setIsLoading(true);
    try {
      // Call registerWithEmailAndPassword with role hardcoded to 'user'
      await registerWithEmailAndPassword(data.email, data.password, data.name, 'user');
      
      toast({ title: "Account Created!", description: `Welcome, ${data.name}! Please wait while we redirect you.` });

      // Always redirect to user dashboard
      router.push('/dashboard/user');

    } catch (error: any) {
      let errorMessage = "Signup failed. Please try again.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email is already registered. Please try logging in or use a different email.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The password is too weak. Please choose a stronger password.";
      } else if (error.code) {
        errorMessage = `Signup error: ${error.message} (Code: ${error.code})`;
      } else if (error.message) {
         errorMessage = error.message;
      }
      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading && !user) { 
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <UserPlus className="mx-auto h-12 w-12 text-primary mb-4" />
        <CardTitle className="text-3xl font-bold">Create Your Account</CardTitle>
        {/* Updated CardDescription */}
        <CardDescription>
          Join The Life Coaching Cafe today to find your ideal life coach.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" {...register('name')} placeholder="e.g., Alex Smith" className={errors.name ? 'border-destructive' : ''} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input id="email" type="email" {...register('email')} placeholder="you@example.com" className={errors.email ? 'border-destructive' : ''} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} className={errors.password ? 'border-destructive' : ''} />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input id="confirmPassword" type="password" {...register('confirmPassword')} className={errors.confirmPassword ? 'border-destructive' : ''} />
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
            </div>
          </div>

          {/* Removed Role Selection RadioGroup */}

          <Button type="submit" disabled={isLoading || authLoading} size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            {isLoading || authLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Creating Account...
              </>
            ) : (
              'Sign Up'
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-center">
        <p className="text-sm text-muted-foreground w-full">
          Already have an account?{' '}
          <Button variant="link" className="p-0 h-auto text-primary" asChild>
            <Link href="/login">Log In</Link>
          </Button>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Loading...</div>}>
      <div className="flex items-center justify-center py-12">
        <SignupFormContent />
      </div>
    </Suspense>
  )
}
