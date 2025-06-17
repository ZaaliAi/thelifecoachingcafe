'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, KeyRound, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { deleteUserAccount, reauthenticateUser as reauthenticateUserForDelete } from '@/lib/firebase';
import { updateUserProfile } from '@/lib/firestore'; // Added for email update in Firestore

import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Firebase auth functions for password change & email change
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateEmail, sendEmailVerification } from 'firebase/auth';

// Zod Schema for Password Change
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required."),
  newPassword: z.string().min(8, "New password must be at least 8 characters long."),
  confirmNewPassword: z.string().min(1, "Please confirm your new password."),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "New passwords don't match.",
  path: ["confirmNewPassword"],
});
type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;

// Zod Schema for Email Change
const emailChangeSchema = z.object({
  newEmail: z.string().email("Invalid email address."),
  currentPasswordForEmail: z.string().min(1, "Current password is required to change email."),
});
type EmailChangeFormData = z.infer<typeof emailChangeSchema>;

// Zod Schema for Delete Account
const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required for re-authentication."),
});
type DeleteAccountFormData = z.infer<typeof deleteAccountSchema>;


export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // --- Delete Account State & Logic ---
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReauthDialog, setShowReauthDialog] = useState(false);
  const {
    control: deleteAccountControl,
    handleSubmit: handleDeleteAccountSubmit,
    formState: { errors: deleteAccountErrors, isSubmitting: isDeleteAccountSubmitting },
    reset: resetDeleteAccountForm,
  } = useForm<DeleteAccountFormData>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: { password: '' },
  });

  const onReauthenticateAndDelete: SubmitHandler<DeleteAccountFormData> = async (data) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsDeleting(true);
    try {
      await reauthenticateUserForDelete(user, data.password);
      await deleteUserAccount();
      toast({ title: "Account Deleted", description: "Your account has been successfully deleted." });
      router.push('/');
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast({
        title: "Error Deleting Account",
        description: error.message || "Failed to delete account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setShowReauthDialog(false);
      resetDeleteAccountForm();
    }
  };

  // --- Password Change State & Logic ---
  const {
    control: passwordControl,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors, isSubmitting: isPasswordSubmitting },
    reset: resetPasswordForm,
  } = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmNewPassword: '' },
  });

  const onPasswordChangeSubmit: SubmitHandler<PasswordChangeFormData> = async (data) => {
    if (!user || !user.email) {
      toast({ title: "Error", description: "User not found. Please re-login.", variant: "destructive" });
      return;
    }
    try {
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, data.newPassword);
      toast({ title: "Success!", description: "Password updated successfully." });
      resetPasswordForm();
    } catch (error: any) {
      console.error("Password change error:", error);
      let errorMessage = "Failed to update password. Please try again.";
      if (error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect current password. Please try again.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many attempts. Please try again later.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "The new password is too weak. Please choose a stronger password.";
      } else if (error.code === 'auth/user-mismatch') {
        errorMessage = "Credential mismatch. Please ensure you are logged in with the correct user.";
      }
      toast({ title: "Error Updating Password", description: errorMessage, variant: "destructive" });
    }
  };

  // --- Email Change State & Logic ---
  const {
    control: emailControl,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors, isSubmitting: isEmailSubmitting },
    reset: resetEmailForm,
  } = useForm<EmailChangeFormData>({
    resolver: zodResolver(emailChangeSchema),
    defaultValues: { newEmail: '', currentPasswordForEmail: '' },
  });

  const onEmailChangeSubmit: SubmitHandler<EmailChangeFormData> = async (data) => {
    if (!user || !user.email) {
      toast({ title: "Error", description: "User not found. Please re-login.", variant: "destructive" });
      return;
    }

    if (user.email === data.newEmail) {
      toast({ title: "Info", description: "The new email address is the same as your current one.", variant: "info" });
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(user.email, data.currentPasswordForEmail);
      await reauthenticateWithCredential(user, credential);
      // toast({ title: "Re-authentication successful", description: "Proceeding to update email address." }); // Optional

      await updateEmail(user, data.newEmail);
      // toast({ title: "Email Updated in Auth", description: "Attempting to send verification email and update profile."}); // Optional

      try {
         await sendEmailVerification(user);
         toast({ title: "Verification Email Sent", description: `A verification email has been sent to ${data.newEmail}. Please verify your new email address.` });
      } catch (verificationError: any) {
         console.error("Error sending verification email:", verificationError);
         toast({ title: "Warning: Verification Email Failed", description: `Could not send verification email to ${data.newEmail}. You may need to re-login or contact support. Your email has been changed but requires verification.`, variant: "warning", duration: 10000 });
      }

      try {
         await updateUserProfile(user.id, { email: data.newEmail });
         toast({ title: "Profile Updated", description: "Email updated in your profile." });
      } catch (firestoreError: any) {
         console.error("Error updating email in Firestore:", firestoreError);
         toast({ title: "Critical Sync Error", description: "Email changed in authentication, but failed to update in profile. Please contact support immediately with your new and old email addresses.", variant: "destructive", duration: 15000 });
      }

      resetEmailForm();
      toast({ title: "Email Change Process Complete", description: "Please check your new email address to verify it.", duration: 7000 });

    } catch (error: any) {
      console.error("Email change error:", error);
      let errorMessage = "Failed to update email. Please try again.";
      if (error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect current password. Please try again.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many attempts. Please try again later.";
      } else if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email address is already in use by another account.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "The new email address is not valid.";
      } else if (error.code === 'auth/user-mismatch') {
        errorMessage = "Credential mismatch. Please ensure you are logged in with the correct user.";
      }
      toast({ title: "Error Changing Email", description: errorMessage, variant: "destructive" });
    }
  };

  if (authLoading) {
    return <div className="p-4"><Loader2 className="animate-spin" /> Loading settings...</div>;
  }

  if (!user) {
    return <div className="p-4">Please log in to view settings.</div>;
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8 text-center">Account Settings</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <Mail className="mr-2 h-5 w-5 text-primary" />
            Change Email Address
          </CardTitle>
          <CardDescription>Update the email address associated with your account. You will need to verify your new email address.</CardDescription>
        </CardHeader>
        <form onSubmit={handleEmailSubmit(onEmailChangeSubmit)}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="newEmail">New Email Address</Label>
              <Controller
                name="newEmail"
                control={emailControl}
                render={({ field }) => <Input id="newEmail" type="email" {...field} placeholder="yournewemail@example.com" />}
              />
              {emailErrors.newEmail && <p className="text-sm text-destructive mt-1">{emailErrors.newEmail.message}</p>}
            </div>
            <div>
              <Label htmlFor="currentPasswordForEmail">Current Password</Label>
              <Controller
                name="currentPasswordForEmail"
                control={emailControl}
                render={({ field }) => <Input id="currentPasswordForEmail" type="password" {...field} placeholder="Enter your current password" />}
              />
              {emailErrors.currentPasswordForEmail && <p className="text-sm text-destructive mt-1">{emailErrors.currentPasswordForEmail.message}</p>}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isEmailSubmitting}>
              {isEmailSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Email Address
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <KeyRound className="mr-2 h-5 w-5 text-primary" />
            Change Password
          </CardTitle>
          <CardDescription>Ensure your account is secure with a strong, unique password.</CardDescription>
        </CardHeader>
        <form onSubmit={handlePasswordSubmit(onPasswordChangeSubmit)}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <Controller
                name="currentPassword"
                control={passwordControl}
                render={({ field }) => <Input id="currentPassword" type="password" {...field} />}
              />
              {passwordErrors.currentPassword && <p className="text-sm text-destructive mt-1">{passwordErrors.currentPassword.message}</p>}
            </div>
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Controller
                name="newPassword"
                control={passwordControl}
                render={({ field }) => <Input id="newPassword" type="password" {...field} />}
              />
              {passwordErrors.newPassword && <p className="text-sm text-destructive mt-1">{passwordErrors.newPassword.message}</p>}
            </div>
            <div>
              <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
              <Controller
                name="confirmNewPassword"
                control={passwordControl}
                render={({ field }) => <Input id="confirmNewPassword" type="password" {...field} />}
              />
              {passwordErrors.confirmNewPassword && <p className="text-sm text-destructive mt-1">{passwordErrors.confirmNewPassword.message}</p>}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isPasswordSubmitting}>
              {isPasswordSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center text-xl text-destructive">
            <Trash2 className="mr-2 h-5 w-5" />
            Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showReauthDialog ? (
            <form onSubmit={handleDeleteAccountSubmit(onReauthenticateAndDelete)} className="space-y-4">
              <div>
                <Label htmlFor="reauthPassword">Enter Password to Confirm Deletion</Label>
                 <Controller
                    name="password"
                    control={deleteAccountControl}
                    render={({ field }) =>  <Input id="reauthPassword" type="password" {...field} placeholder="Enter your password" />}
                  />
                {deleteAccountErrors.password && <p className="text-sm text-destructive mt-1">{deleteAccountErrors.password.message}</p>}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => { setShowReauthDialog(false); resetDeleteAccountForm(); }} disabled={isDeleting}>Cancel</Button>
                <Button type="submit" variant="destructive" disabled={isDeleting || isDeleteAccountSubmitting}>
                  {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Deletion
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              If you are sure you want to delete your account, click the button below.
              You will be asked to re-authenticate.
            </p>
          )}
        </CardContent>
        <CardFooter>
          {!showReauthDialog && (
            <Button variant="destructive" onClick={() => setShowReauthDialog(true)} disabled={isDeleting}>
              Delete My Account
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
