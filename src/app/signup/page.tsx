"use client";

import { useState, useEffect, Suspense } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
  terms: z.boolean().refine(val => val === true, {
    message: "You must accept the terms and conditions.",
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

function SignupFormContent() {
  const [isLoading, setIsLoading] = useState(false);
  const { user, loading: authLoading, signup } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const { control, register, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      terms: false,
    }
  });

  useEffect(() => {
    if (!authLoading && user) {
      if (router && typeof router.pathname === 'string' && !router.pathname.includes('/dashboard')) {
        router.push('/dashboard/user');
      }
    }
  }, [user, authLoading, router]);

  const onSubmit: SubmitHandler<SignupFormData> = async (data) => {
    setIsLoading(true);
    try {
      await signup(data.name, data.email, data.password, 'user');
      
      toast({ title: "Account Created!", description: `Welcome, ${data.name}! Please wait while we redirect you.` });

      router.push('/dashboard/user');

    } catch (error: any) {
      let errorMessage = "Signup failed. Please try again.";
      if (error && typeof error.code === 'string') {
        if (error.code === 'auth/email-already-in-use') {
          errorMessage = "This email is already registered. Please try logging in or use a different email.";
        } else if (error.code === 'auth/weak-password') {
          errorMessage = "The password is too weak. Please choose a stronger password.";
        } else if (error.message) {
          errorMessage = `Signup error: ${String(error.message)} (Code: ${error.code})`;
        }
      } else if (error && error.message) {
         errorMessage = String(error.message);
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      toast({
        title: "Signup Failed",
        description: String(errorMessage),
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

          <Controller
            name="terms"
            control={control}
            render={({ field }) => (
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="terms"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mt-1"
                />
                <div className="grid gap-1.5 leading-none">
                  <Label htmlFor="terms" className="cursor-pointer">
                    I agree to the <Link href="/terms-and-conditions" className="text-primary underline hover:text-primary/90">terms and conditions</Link>.
                  </Label>
                  {errors.terms && <p className="text-sm text-destructive">{errors.terms.message}</p>}
                </div>
              </div>
            )}
          />

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
