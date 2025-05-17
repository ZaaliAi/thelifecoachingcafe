
"use client";

import { useState, useEffect } from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types';
import type { FirebaseError } from 'firebase/app';

const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
  role: z.enum(['user', 'coach'], { required_error: 'Please select a role.' }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { signup, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const { control, register, handleSubmit, formState: { errors } } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  useEffect(() => {
    if (!authLoading && user) {
      // User is now authenticated (due to onAuthStateChanged after signup)
      // Redirect based on the role they signed up with or determined by AuthProvider
      toast({ title: "Account Created!", description: `Welcome, ${user.name}! You are now logged in.` });
      if (user.role === 'coach') {
        router.push('/register-coach'); // Redirect to complete coach profile
      } else {
        router.push('/dashboard/user'); // Redirect to user dashboard
      }
    }
  }, [user, authLoading, router, toast]);

  const onSubmit: SubmitHandler<SignupFormData> = async (data) => {
    setIsLoading(true);
    try {
      await signup(data.name, data.email, data.password, data.role);
      // Successful signup, onAuthStateChanged in AuthProvider will set user.
      // The useEffect above will handle redirection.
      // We don't push router here, as useEffect handles it when `user` state updates.
    } catch (error: any) {
      setIsLoading(false);
      let errorMessage = "Signup failed. Please try again.";
      if ((error as FirebaseError).code === 'auth/email-already-in-use') {
        errorMessage = "This email is already registered. Try logging in.";
      } else if ((error as FirebaseError).code) {
        errorMessage = `Signup error: ${(error as FirebaseError).message}`;
      }
      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
    // setIsLoading(false); // setLoading(false) is handled in AuthProvider or error block
  };
  
  // Prevent rendering form if already logged in and redirecting
  if (authLoading || (!authLoading && user)) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <UserPlus className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">Create Your Account</CardTitle>
          <CardDescription>
            Join CoachConnect today to find or become a life coach.
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

            <div className="space-y-2">
              <Label>I am a:</Label>
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="user" id="role-user" />
                      <Label htmlFor="role-user" className="font-normal">User (Seeking a coach)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="coach" id="role-coach" />
                      <Label htmlFor="role-coach" className="font-normal">Coach (Want to offer services)</Label>
                    </div>
                  </RadioGroup>
                )}
              />
              {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
            </div>

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
    </div>
  );
}
