"use client";

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UserCircle, Save, ShieldCheck, Bell, AlertCircle } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth'; 
import { getUserProfile, setUserProfile } from '@/lib/firestore'; 
import type { FirestoreUserProfile } from '@/types';

// Firebase Auth imports for password change logic
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";

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
  newPassword: z.string().optional(), // Make min length conditional
  confirmNewPassword: z.string().optional(),
  enableNotifications: z.boolean().default(false),
}).refine(data => {
    if (data.newPassword && !data.currentPassword) return false;
    if (data.newPassword && (data.newPassword.length < 8)) return false;
    if (data.newPassword && data.newPassword !== data.confirmNewPassword) return false;
    return true;
}, {
  message: "New passwords must be at least 8 characters and match, and current password is required.",
  path: ["confirmNewPassword"],
});

type UserSettingsFormData = z.infer<typeof userSettingsSchema>;

export default function UserSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(true);
  const { user } = useAuth(); 
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
    if (user && user.id) {
      const fetchProfile = async () => {
        setIsFetchingProfile(true);
        try {
          const userProfileData = await getUserProfile(user.id);

          if (userProfileData) {
            reset({
              name: userProfileData.name || user.displayName || '',
              email: user.email || '', 
              enableNotifications: userProfileData.enableNotifications === undefined ? true : userProfileData.enableNotifications,
              currentPassword: '',
              newPassword: '',
              confirmNewPassword: '',
            });
          } else {
             reset({
              name: user.displayName || '',
              email: user.email || '',
              enableNotifications: true, // Default if no profile found
            });
            toast({
              title: "Profile not fully loaded",
              description: "Some settings might not be pre-filled. You can set them now.",
              variant: "default"
            })
          }
        } catch (error) {
          console.error("Failed to fetch user profile:", error);
          toast({
            title: "Error Loading Profile",
            description: "There was an issue fetching your profile settings. Using defaults.",
            variant: "destructive",
          });
           reset({ 
            name: user.displayName || '',
            email: user.email || '',
            enableNotifications: true,
          });
        } finally {
          setIsFetchingProfile(false);
        }
      };
      fetchProfile();
    } else if (!user && typeof user !== "undefined") { // user is null or undefined explicitly, not just during initial load
        setIsFetchingProfile(false);
    }
  }, [user, reset, toast]);

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

      // Password change logic (with Firebase Auth)
      if (data.newPassword && data.currentPassword) {
        const auth = getAuth();
        const userObj = auth.currentUser;
        if (!userObj || !userObj.email) {
          throw new Error("You must be logged in to update your password.");
        }
        // Re-authenticate user
        const credential = EmailAuthProvider.credential(userObj.email, data.currentPassword);
        await reauthenticateWithCredential(userObj, credential);

        // Update password
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
      reset({ ...data, currentPassword: '', newPassword: '', confirmNewPassword: '' }); // Clear passwords after submit
    } catch (error: any) {
      console.error("Error updating settings:", error);
      let errorMessage = error?.message || "Could not save settings. Please try again.";
      // More user-friendly Firebase Auth error messages
      if (error.code === "auth/wrong-password") errorMessage = "The current password you entered is incorrect.";
      if (error.code === "auth/weak-password") errorMessage = "The new password is too weak. Please use at least 6 characters.";
      if (error.code === "auth/too-many-requests") errorMessage = "Too many failed attempts. Please try again later.";
      toast({ title: "Update Failed", description: errorMessage, variant: "destructive"});
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetchingProfile && user === undefined) { // Still waiting for useAuth to provide user object
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user && !isFetchingProfile) { // user is null (logged out) and we are not fetching
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

  return (
    <Card className="shadow-lg max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <UserCircle className="mr-3 h-7 w-7 text-primary" />
          Account Settings
        </CardTitle>
        <CardDescription>Manage your profile information, password, and notification preferences.</CardDescription>
      </CardHeader>
      {isFetchingProfile ? (
         <CardContent className="py-10 flex items-center justify-center">
           <Loader2 className="h-10 w-10 animate-spin text-primary" />
         </CardContent>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-8 pt-6">
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

          </CardContent>
          <CardFooter className="pt-6 border-t mt-6">
            <Button type="submit" disabled={isLoading || isFetchingProfile || !isDirty} size="lg" className="w-full sm:w-auto ml-auto bg-primary hover:bg-primary/90 text-primary-foreground">
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
  );
}