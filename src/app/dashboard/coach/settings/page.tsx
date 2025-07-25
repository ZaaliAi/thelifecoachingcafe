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
import { DeleteAccountDialog } from '@/components/dashboard/DeleteAccountDialog';

import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Firebase auth functions for password change
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from 'firebase/auth';
// Firebase Functions import for calling the backend function
import { getFunctions, httpsCallable } from 'firebase/functions'; 
import { firebaseApp } from '@/lib/firebase'; // Correctly import firebaseApp


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

export default function SettingsPage() {
  const { user, firebaseUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // --- Delete Account State & Logic ---
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');


  const triggerDeleteAccountProcess = () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to delete your account.", variant: "destructive" });
      return;
    }
    setShowDeleteConfirmDialog(true);
  };

  const executeAccountDeletion = async () => {
    setIsDeleting(true);
    
    const auth = getAuth(firebaseApp);
    const currentUser = auth.currentUser;

    if (!currentUser || !currentUser.email) {
      toast({ title: "Authentication Error", description: "Could not find user to re-authenticate.", variant: "destructive" });
      setIsDeleting(false);
      return;
    }

    if (!deletePassword) {
      toast({ title: "Password Required", description: "Please enter your password to confirm deletion.", variant: "destructive" });
      setIsDeleting(false);
      return;
    }

    try {
      const credential = EmailAuthProvider.credential(currentUser.email, deletePassword);
      await reauthenticateWithCredential(currentUser, credential);
      
      const functionsInstance = getFunctions(firebaseApp); 
      const deleteUserCallable = httpsCallable(functionsInstance, 'deleteUserAccount');
      const result = await deleteUserCallable();
      
      toast({
        title: "Account Deletion Successful",
        description: (result.data as {message: string}).message || "Your account has been permanently deleted.",
      });
      
      await signOut(auth);
      window.location.href = '/'; 

    } catch (error: any) {
      console.error("Error deleting account:", error);
      let description = "Could not delete your account. Please try again later.";
      if (error.code === 'auth/wrong-password') {
        description = "The password you entered is incorrect.";
      } else if (error.message) {
        description = error.message;
      }
      toast({
        title: "Account Deletion Failed",
        description: description,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeletePassword('');
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
    if (!firebaseUser || !firebaseUser.email) {
      toast({ title: "Error", description: "User not found. Please re-login.", variant: "destructive" });
      return;
    }
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, data.currentPassword);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updatePassword(firebaseUser, data.newPassword);
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

  if (authLoading) {
    return <div className="p-4"><Loader2 className="animate-spin" /> Loading settings...</div>;
  }

  if (!user) {
    return <div className="p-4">Please log in to view settings.</div>;
  }

  return (
    <>
    <div className="container mx-auto p-4 md:p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8 text-center">Account Settings</h1>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center text-xl">
            <Mail className="mr-2 h-5 w-5 text-primary" />
            Email Address
          </CardTitle>
          <CardDescription>This is the email address associated with your account. It cannot be changed.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-medium text-muted-foreground">{user.email}</p>
        </CardContent>
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
          <p className="text-sm text-muted-foreground">
            If you are sure you want to delete your account, click the button below.
          </p>
        </CardContent>
        <CardFooter>
            <Button variant="destructive" onClick={triggerDeleteAccountProcess} disabled={isDeleting}>
              Delete My Account
            </Button>
        </CardFooter>
      </Card>
    </div>
    <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is irreversible. To confirm, please enter your password below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="delete-password-confirm" className="sr-only">Password</Label>
            <Input 
              id="delete-password-confirm"
              type="password"
              placeholder="Enter your password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeAccountDeletion} 
              disabled={isDeleting || !deletePassword}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
              ) : (
                'Yes, Delete My Account'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
