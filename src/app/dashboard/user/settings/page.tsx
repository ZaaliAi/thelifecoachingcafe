'use client';

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Loader2, UserCircle, Save, ShieldCheck, Bell, AlertCircle, AlertTriangle } from "lucide-react"; 
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth'; 
import { getUserProfile, setUserProfile } from '@/lib/firestore'; 
import type { FirestoreUserProfile, FirebaseUser } from '@/types';

// Firebase Auth imports for password change logic and signout
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from "firebase/auth";
// Firebase Functions import for calling the backend function
import { getFunctions, httpsCallable } from "firebase/functions"; 
import { firebaseApp } from '@/lib/firebase'; // Correctly import firebaseApp

// Utility to remove undefined fields (Firestore does not allow undefined!)
function pruneUndefined<T extends object>(obj: T): Partial<T> {
  return Object.entries(obj)
    .filter(([_, v]) => v !== undefined)
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}) as Partial<T>;
}

const userSettingsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'), 
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmNewPassword: z.string().optional(),
  enableNotifications: z.boolean().default(false),
}).refine(data => {
    if (data.newPassword && !data.currentPassword) return false;
    if (data.newPassword && (data.newPassword.length < 8)) return false;
    if (data.newPassword && data.newPassword !== data.confirmNewPassword) return false;
    return true;
}, {
  message: "New passwords must be at least 8 characters and match, and current password is required if changing password.",
  path: ["confirmNewPassword"],
});

type UserSettingsFormData = z.infer<typeof userSettingsSchema>;

export default function UserSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); 
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const { user, loading: authLoading } = useAuth(); 
  const { toast } = useToast();

  const { register, handleSubmit, control, reset, formState: { errors, isDirty } } = useForm<UserSettingsFormData>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
        name: '',
        email: '',
        enableNotifications: false,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
    }
  });

  useEffect(() => {
    // Only attempt to fetch profile if user is loaded and auth is not loading
    if (user && user.id && !authLoading) {
      const fetchProfile = async () => {
        setIsFetchingProfile(true); // Indicate start of profile fetching for this component
        try {
          const userProfileData = await getUserProfile(user.id) as FirestoreUserProfile | null;

          if (userProfileData) {
            reset({
              name: userProfileData.name || (user as FirebaseUser).displayName || '',
              email: (user as FirebaseUser).email || '', 
              enableNotifications: userProfileData.enableNotifications === undefined ? true : userProfileData.enableNotifications,
              currentPassword: '',
              newPassword: '',
              confirmNewPassword: '',
            });
          } else {
            // User exists in Auth, but no profile document in Firestore (e.g., new user)
            reset({
              name: (user as FirebaseUser).displayName || '',
              email: (user as FirebaseUser).email || '',
              enableNotifications: true, // Default value
            });
            toast({
              title: "Set up your profile",
              description: "It looks like this is your first time, or your profile isn't fully set up. Please review and save your settings.",
              variant: "default",
              duration: 7000,
            });
          }
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          toast({
            title: "Error Loading Profile",
            description: "There was an issue fetching your profile settings. Using defaults.",
            variant: "destructive",
          });
          // Reset with auth defaults if profile fetch fails
          reset({ 
            name: (user as FirebaseUser).displayName || '',
            email: (user as FirebaseUser).email || '',
            enableNotifications: true,
          });
        } finally {
          setIsFetchingProfile(false); // Indicate end of profile fetching
        }
      };
      fetchProfile();
    } else if (!user && !authLoading) {
      // If there's no user and auth is done loading, no profile to fetch.
      setIsFetchingProfile(false);
    }
    // Dependencies: effect runs if user or authLoading state changes.
    // reset and toast are stable references from hooks.
  }, [user, authLoading, reset, toast]);

  const onSubmit: SubmitHandler<UserSettingsFormData> = async (data) => {
    setIsLoading(true);
    if (!user || !user.id) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    try {
      let profileUpdateData: Partial<FirestoreUserProfile> = {
        name: data.name,
        enableNotifications: data.enableNotifications,
      };

      profileUpdateData = pruneUndefined(profileUpdateData);
      await setUserProfile(user.id, profileUpdateData);

      let passwordChanged = false;
      if (data.newPassword && data.currentPassword) {
        const auth = getAuth(firebaseApp); 
        const userObj = auth.currentUser;
        if (!userObj || !userObj.email) {
          throw new Error("You must be logged in to update your password.");
        }
        const credential = EmailAuthProvider.credential(userObj.email, data.currentPassword);
        await reauthenticateWithCredential(userObj, credential);
        await updatePassword(userObj, data.newPassword);
        passwordChanged = true;
        toast({ title: "Password Updated", description: "Your password was updated successfully." });
      } else if (data.newPassword && !data.currentPassword){
         toast({ title: "Password Error", description: "Current password is required to set a new password.", variant: "destructive" });
         setIsLoading(false);
         return;
      }

      toast({ 
        title: "Settings Updated!", 
        description: `Your settings have been saved. ${passwordChanged ? "Password has been changed." : ""}` 
      });
      reset({ ...data, currentPassword: '', newPassword: '', confirmNewPassword: '' }, { keepDirty: false });
    } catch (error: any) {
      console.error("Error updating settings:", error);
      let errorMessage = error?.message || "Could not save settings. Please try again.";
      if (error.code === "auth/wrong-password") errorMessage = "The current password you entered is incorrect.";
      if (error.code === "auth/weak-password") errorMessage = "The new password is too weak. Please use at least 8 characters."; 
      if (error.code === "auth/too-many-requests") errorMessage = "Too many failed attempts. Please try again later.";
      toast({ title: "Update Failed", description: errorMessage, variant: "destructive"});
    } finally {
      setIsLoading(false);
    }
  };

  const triggerDeleteAccountProcess = () => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to delete your account.", variant: "destructive" });
      return;
    }
    setShowDeleteConfirmDialog(true);
  };

  const executeAccountDeletion = async () => {
    setIsDeleting(true);
    setShowDeleteConfirmDialog(false); 
    try {
      const functionsInstance = getFunctions(firebaseApp); 
      const deleteUserCallable = httpsCallable(functionsInstance, 'deleteUserAccount');
      const result = await deleteUserCallable();
      
      toast({
        title: "Account Deletion Successful",
        description: (result.data as {message: string}).message || "Your account has been permanently deleted.",
      });
      
      const auth = getAuth(firebaseApp); 
      await signOut(auth);
      window.location.href = '/'; 

    } catch (error: any) {
      console.error("Error deleting account:", error);
      let description = "Could not delete your account. Please try again later.";
      if (error && typeof error.code === 'string' && typeof error.message === 'string') {
        description = error.message; 
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
    }
  };

  // This is the main page loading state, waiting for Firebase Auth to be ready.
  if (authLoading) { 
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  // After Auth is ready, if there's no user, deny access.
  if (!user && !authLoading) { 
     return (
        <Card className="shadow-lg max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle className="text-2xl flex items-center">
                    <AlertCircle className="mr-3 h-7 w-7 text-destructive" />
                    Access Denied
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p>You need to be logged in to access this page.</p>
                <Button asChild variant="link" className="mt-4 px-0">
                    <a href="/login">Go to Login</a>
                </Button>
            </CardContent>
        </Card>
     );
  }

  // If user is authenticated, render the settings page content.
  return (
    <>
      <Card className="shadow-lg max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <UserCircle className="mr-3 h-7 w-7 text-primary" />
            Account Settings
          </CardTitle>
          <CardDescription>Manage your profile information, password, and notification preferences.</CardDescription>
        </CardHeader>
        {/* This loader is for fetching the profile data for the form after user is confirmed.*/}
        {isFetchingProfile ? (
           <CardContent className="py-10 flex items-center justify-center">
             <Loader2 className="h-10 w-10 animate-spin text-primary" />
           </CardContent>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-8 pt-6">
              {/* Profile Information Section */}
              <section>
                <h3 className="text-lg font-semibold mb-4 border-b pb-2">Profile Information</h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="name">Full Name</Label>
                    <Controller
                      name="name"
                      control={control}
                      render={({ field }) => <Input id="name" {...field} className={errors.name ? 'border-destructive' : ''} />}
                    />
                    {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="email">Email Address</Label>
                    <Controller
                      name="email"
                      control={control}
                      render={({ field }) => <Input id="email" type="email" {...field} readOnly className="bg-muted/50 cursor-not-allowed" />}
                    />
                  </div>
                </div>
              </section>

              {/* Change Password Section */}
              <section>
                <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center">
                    <ShieldCheck className="mr-2 h-5 w-5 text-muted-foreground" />Change Password
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input id="currentPassword" type="password" {...register('currentPassword')} autoComplete="current-password" />
                     {errors.confirmNewPassword && !errors.newPassword && <p className="text-sm text-destructive">{errors.confirmNewPassword.message}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input id="newPassword" type="password" {...register('newPassword')} className={errors.newPassword ? 'border-destructive' : ''} autoComplete="new-password" />
                      {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                      <Input id="confirmNewPassword" type="password" {...register('confirmNewPassword')} className={errors.confirmNewPassword ? 'border-destructive' : ''} autoComplete="new-password" />
                       {errors.confirmNewPassword && errors.newPassword && <p className="text-sm text-destructive">{errors.confirmNewPassword.message}</p>}
                    </div>
                  </div>
                </div>
              </section>
              
              {/* Notification Settings Section */}
              <section>
                <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center">
                    <Bell className="mr-2 h-5 w-5 text-muted-foreground" />Notification Settings
                </h3>
                <div className="flex items-center justify-between p-4 border rounded-md bg-muted/20">
                    <div>
                        <Label htmlFor="enableNotifications" className="text-base font-medium">Enable Email Notifications</Label>
                        <p className="text-sm text-muted-foreground">Receive updates about messages and platform news.</p>
                    </div>
                    <Controller
                        name="enableNotifications"
                        control={control}
                        render={({ field }) => (
                            <Switch
                            id="enableNotifications"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            aria-label="Toggle email notifications"
                            />
                        )}
                    />
                </div>
              </section>

              {/* Danger Zone Section */}
              <section>
                  <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center text-destructive">
                      <AlertTriangle className="mr-2 h-5 w-5" />Danger Zone
                  </h3>
                  <div className="p-4 border border-destructive/50 rounded-md bg-destructive/5 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                          <div>
                              <Label htmlFor="deleteAccountButton" className="text-base font-medium text-destructive">Delete Account</Label>
                              <p className="text-sm text-muted-foreground">Permanently delete your account and all associated data. This action cannot be undone.</p>
                          </div>
                          <Button
                              id="deleteAccountButton"
                              variant="destructive"
                              type="button" 
                              onClick={triggerDeleteAccountProcess} 
                              className="mt-3 sm:mt-0 sm:ml-4"
                              disabled={isDeleting || isLoading} 
                          >
                            {isDeleting ? (
                              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</>
                            ) : (
                              'Delete My Account'
                            )}
                          </Button>
                      </div>
                  </div>
              </section>

            </CardContent>
            <CardFooter className="pt-6 border-t mt-6">
              <Button type="submit" disabled={isLoading || isFetchingProfile || !isDirty || isDeleting} size="lg" className="w-full sm:w-auto ml-auto bg-primary hover:bg-primary/90 text-primary-foreground">
                {isLoading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Saving...</>
                ) : (
                  <><Save className="mr-2 h-5 w-5" /> Save Changes</>
                )}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>

      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account 
              and remove all your data from our servers. 
              Please be certain before proceeding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={executeAccountDeletion} 
              disabled={isDeleting}
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
