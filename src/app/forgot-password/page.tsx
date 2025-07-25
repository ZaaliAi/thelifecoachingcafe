"use client";

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address.'),
});
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  console.log("ForgotPasswordPage rendering. Submitted state:", submitted, "IsLoading state:", isLoading); // Log for render

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit: SubmitHandler<ForgotPasswordFormData> = async (data: { email: string; }) => {
    console.log("Attempting password reset for:", data.email);
    setIsLoading(true);
    try {
      const auth = getAuth();
      console.log("Before calling sendPasswordResetEmail for:", data.email);
      await sendPasswordResetEmail(auth, data.email);
      console.log("After calling sendPasswordResetEmail (success) for:", data.email);
      toast({
        title: "Password Reset Email Sent",
        description: (() => {
          console.log("Success toast description function called for:", data.email);
          return `If an account exists for ${data.email}, you will receive password reset instructions. Please check your inbox (and spam folder).`;
        })(),
      });
      setSubmitted(true);
      console.log("setSubmitted(true) called. Submitted state should be true now.");
    } catch (error: any) {
      console.error("Password reset error (full object):", JSON.stringify(error, Object.getOwnPropertyNames(error)));
      toast({
        title: "Error Sending Reset Email",
        description: error.message || "An unexpected error occurred. Please ensure you are online and try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      console.log("In finally block. setIsLoading(false) called.");
    }
  };

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <Mail className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">Forgot Password?</CardTitle>
          <CardDescription>
            {submitted 
              ? "Check your email for reset instructions." 
              : "Enter your email address and we'll send you a link to reset your password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!submitted ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" {...register('email')} placeholder="you@example.com" className={errors.email ? 'border-destructive' : ''} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <Button type="submit" disabled={isLoading} size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>
          ) : (
            <div className="text-center">
              <p className="text-muted-foreground">If you don't see the email, please check your spam folder or try again later.</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="text-center">
          <Button variant="link" asChild className="text-muted-foreground">
            <Link href="/login">
              <>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Login
              </>
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
