'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAuth, verifyPasswordResetCode, confirmPasswordReset, applyActionCode, checkActionCode } from 'firebase/auth';
import { firebaseApp } from '@/lib/firebase';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { Loader2, KeyRound, MailCheck, AlertCircle } from 'lucide-react';

function FirebaseActionHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [mode, setMode] = useState<string | null>(null);
  const [actionCode, setActionCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [emailForReset, setEmailForReset] = useState<string | null>(null);
  const [verifiedCode, setVerifiedCode] = useState(false);

  useEffect(() => {
    const currentMode = searchParams.get('mode');
    const currentActionCode = searchParams.get('oobCode');
    
    setMode(currentMode);
    setActionCode(currentActionCode);

    if (!currentMode || !currentActionCode) {
      setError("Invalid link. Mode or action code is missing.");
      setLoading(false);
      return;
    }

    const auth = getAuth(firebaseApp);
    setLoading(true);

    switch (currentMode) {
      case 'resetPassword':
        verifyPasswordResetCode(auth, currentActionCode)
          .then((email) => {
            setEmailForReset(email);
            setVerifiedCode(true);
            setMessage("Please enter your new password.");
            setLoading(false);
          })
          .catch((err) => {
            console.error("Error verifying password reset code:", err);
            setError("Invalid or expired password reset link. Please try requesting a new one.");
            setLoading(false);
          });
        break;
      case 'verifyEmail':
        checkActionCode(auth, currentActionCode)
          .then((info) => {
            return applyActionCode(auth, currentActionCode);
          })
          .then(() => {
            setMessage("Your email has been verified successfully! You can now log in.");
            toast({ title: "Email Verified", description: "You can now log in with your email." });
            setLoading(false);
          })
          .catch((err) => {
            console.error("Error verifying email:", err);
            setError("Invalid or expired email verification link, or email already verified.");
            setLoading(false);
          });
        break;
      default:
        setError("Unsupported action. Please check the link and try again.");
        setLoading(false);
    }
  }, [searchParams, toast, router]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      return;
    }
    if (!actionCode) {
      setError("Action code is missing. Cannot reset password.");
      return;
    }
    if (newPassword.length < 6) {
        setError("Password must be at least 6 characters long.");
        toast({ title: "Error", description: "Password must be at least 6 characters long.", variant: "destructive" });
        return;
    }

    setLoading(true);
    setError(null);
    const auth = getAuth(firebaseApp);

    try {
      await confirmPasswordReset(auth, actionCode, newPassword);
      setMessage("Password has been reset successfully! You can now log in with your new password.");
      toast({ title: "Success", description: "Password reset successfully. Please log in." });
      setVerifiedCode(false); 
      router.push('/login');
    } catch (err: any) {
      console.error("Error confirming password reset:", err);
      setError(err.message || "Failed to reset password. The link may have expired or been used already.");
      toast({ title: "Error Reserting Password", description: err.message || "Failed to reset password.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading && !error && !message) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg">Processing your request...</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen py-12 bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          {mode === 'resetPassword' && <KeyRound className="mx-auto h-12 w-12 text-primary mb-4" />}
          {mode === 'verifyEmail' && <MailCheck className="mx-auto h-12 w-12 text-green-500 mb-4" />}
          {!mode && error && <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />}
          <CardTitle className="text-3xl font-bold">
            {mode === 'resetPassword' && "Reset Your Password"}
            {mode === 'verifyEmail' && "Verify Your Email"}
            {!mode && error && "Invalid Action"}
            {!mode && !error && "Processing..."}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !error && (
             <div className="flex flex-col items-center justify-center py-6">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                <p>Please wait...</p>
            </div>
          )}

          {error && (
            <div className="text-center text-destructive space-y-2">
              <AlertCircle className="mx-auto h-8 w-8" />
              <p className="font-semibold">Error</p>
              <p>{error}</p>
              <Button onClick={() => router.push('/login')} variant="outline">Go to Login</Button>
            </div>
          )}

          {!loading && !error && message && mode !== 'resetPassword' && (
            <div className="text-center text-green-600 space-y-2">
              <MailCheck className="mx-auto h-8 w-8" />
              <p className="font-semibold">Success!</p>
              <p>{message}</p>
              <Button onClick={() => router.push('/login')}>Go to Login</Button>
            </div>
          )}
          
          {!loading && !error && verifiedCode && mode === 'resetPassword' && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              {emailForReset && <p className="text-sm text-center text-gray-600 dark:text-gray-400">Resetting password for: {emailForReset}</p>}
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input 
                  id="newPassword" 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                <Input 
                  id="confirmNewPassword" 
                  type="password" 
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required 
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Reset Password
              </Button>
            </form>
          )}

          {!loading && !error && !verifiedCode && message && mode === 'resetPassword' && (
             <div className="text-center text-green-600 space-y-2">
                <KeyRound className="mx-auto h-8 w-8" />
                <p className="font-semibold">Success!</p>
                <p>{message}</p>
                <Button onClick={() => router.push('/login')}>Proceed to Login</Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

export default function FirebaseActionPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin" /> <p className='ml-4 text-lg'>Loading page...</p></div>}>
      <FirebaseActionHandler />
    </Suspense>
  );
}
