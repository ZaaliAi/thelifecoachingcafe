"use client";

import { useState, useEffect, Suspense } from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '@/lib/auth'; // Still used for user state and loading
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types';
// Import Firebase auth and the auth instance
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Your initialized Firebase auth instance
import { adminFirestore } from '@/lib/firebaseAdmin'; // Assuming you might want to write role to Firestore from backend later. For client-side, use 'db' from '@/lib/firebase'
import { doc, setDoc } from "firebase/firestore"; // To write user role to Firestore
import { db } from '@/lib/firebase'; // Import db for client-side Firestore writes


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

function SignupFormContent() {
  const [isLoading, setIsLoading] = useState(false);
  // 'user' from useAuth will be updated by onAuthStateChanged in AuthProvider
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') === 'coach' ? 'coach' : 'user';

  const { control, register, handleSubmit, formState: { errors }, setValue } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      role: initialRole,
    }
  });

  useEffect(() => {
    setValue('role', initialRole);
  }, [initialRole, setValue]);

  useEffect(() => {
    if (!authLoading && user) {
      // User is now a FirebaseUser. It won't have 'role' or 'name' directly
      // unless you've updated the profile or stored it elsewhere.
      // The redirect logic might need to be adjusted based on how you store roles.
      // For now, let's assume a user object means they are logged in.
      const firebaseUser = user; // user from useAuth() is now FirebaseUser

      // This redirection logic might be hit if onAuthStateChanged updates the user
      // before the onSubmit redirection completes, or if a logged-in user revisits /signup.
      if (router.pathname === '/signup') {
        toast({ title: "Already Logged In", description: `Redirecting to your dashboard, ${firebaseUser.displayName || firebaseUser.email}.` });
        
        // To determine role for redirection, you'd ideally fetch it from Firestore.
        // For an immediate redirect post-signup, we'll use the role from the form data (see onSubmit).
        // This block is more for users who are already logged in and land here.
        // We'll need a more robust way to get the user's role if not immediately after signup.
        // For now, we'll assume if they have a Firebase user object, they are logged in.
        // A proper role-based redirect here would require fetching their profile/role from Firestore.
        router.push('/dashboard/user'); // Or a generic dashboard, then fetch role
      }
    }
  }, [user, authLoading, router, toast]);

  const onSubmit: SubmitHandler<SignupFormData> = async (data) => {
    setIsLoading(true);
    try {
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
      const firebaseUser = userCredential.user;

      // Update Firebase user's profile with the name
      await updateProfile(firebaseUser, { displayName: data.name });
      console.log("Firebase profile updated with displayName:", data.name);

      // Store user role and other details in Firestore
      // This is a client-side write. Ensure your Firestore rules allow this.
      // The document ID should be the user's UID.
      const userDocRef = doc(db, "users", firebaseUser.uid);
      await setDoc(userDocRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: data.name, // Storing name from form
        role: data.role, // Storing role from form
        createdAt: new Date(), // Or use serverTimestamp() if preferred and configured
      });
      console.log("User role and details stored in Firestore for UID:", firebaseUser.uid);

      // `onAuthStateChanged` in AuthProvider will set the user context automatically.
      // The user object in the context will now be the Firebase user.

      toast({ title: "Account Created!", description: `Welcome, ${data.name}! Please wait while we redirect you.` });

      // Redirect based on the role selected during signup
      if (data.role === 'coach') {
        router.push(`/register-coach?email=${encodeURIComponent(data.email)}&name=${encodeURIComponent(data.name)}`);
      } else {
        router.push('/dashboard/user');
      }
      // No need to call setIsLoading(false) if redirecting immediately.
    } catch (error: any) {
      setIsLoading(false);
      let errorMessage = "Signup failed. Please try again.";
      // Firebase error codes for createUserWithEmailAndPassword
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email is already registered. Please try logging in or use a different email.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The password is too weak. Please choose a stronger password.";
      } else if (error.code) { // Catch other Firebase auth errors
        errorMessage = `Signup error: ${error.message} (Code: ${error.code})`;
      } else if (error.message) { // Catch non-Firebase errors
         errorMessage = error.message;
      }
      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  if (authLoading) { // Simplified loading check
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If user is already logged in (and not loading), and on signup page, this might indicate
  // the useEffect for redirection hasn't fired or user navigated back.
  // The useEffect handles redirection for already logged-in users.
  // This component should primarily render the form if no user is present or still loading.

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <UserPlus className="mx-auto h-12 w-12 text-primary mb-4" />
        <CardTitle className="text-3xl font-bold">Create Your Account</CardTitle>
        <CardDescription>
          Join The Life Coaching Cafe today to find or become a life coach.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* ... keep your form inputs as they are ... */}
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
                  value={field.value}
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
  );
}

// The rest of your SignupPage component (wrapper with Suspense) remains the same:
export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Loading...</div>}>
      <div className="flex items-center justify-center py-12">
        <SignupFormContent />
      </div>
    </Suspense>
  )
}
