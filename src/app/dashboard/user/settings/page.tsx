
"use client";

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UserCircle, Save, ShieldCheck, Bell } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
// import { useAuth } from '@/lib/auth'; // To get current user data

const userSettingsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').optional(),
  email: z.string().email('Invalid email address.').optional(), // Email might be display only
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.').optional(),
  confirmNewPassword: z.string().optional(),
  enableNotifications: z.boolean().optional(),
}).refine(data => {
    if (data.newPassword && !data.currentPassword) return false; // Need current password to set new
    if (data.newPassword && data.newPassword !== data.confirmNewPassword) return false;
    return true;
}, {
  message: "New passwords don't match or current password missing.",
  path: ["confirmNewPassword"],
});

type UserSettingsFormData = z.infer<typeof userSettingsSchema>;

export default function UserSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  // const { user } = useAuth(); // Get current user for pre-filling
  const { toast } = useToast();

  // Mock current user data
  const currentUser = { name: "Valued User", email: "user@example.com", enableNotifications: true };

  const { register, handleSubmit, control, formState: { errors } } = useForm<UserSettingsFormData>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: {
        name: currentUser.name,
        email: currentUser.email,
        enableNotifications: currentUser.enableNotifications,
    }
  });

  const onSubmit: SubmitHandler<UserSettingsFormData> = async (data) => {
    setIsLoading(true);
    console.log('Updating user settings:', data);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    toast({
      title: "Settings Updated!",
      description: "Your settings have been saved successfully.",
    });
  };

  return (
    <Card className="shadow-lg max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <UserCircle className="mr-3 h-7 w-7 text-primary" />
          Account Settings
        </CardTitle>
        <CardDescription>Manage your profile information, password, and notification preferences.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-8">
          {/* Profile Information Section */}
          <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Profile Information</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" {...register('name')} className={errors.name ? 'border-destructive' : ''} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email Address (Display Only)</Label>
                <Input id="email" type="email" {...register('email')} readOnly className="bg-muted/50" />
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
                <Input id="currentPassword" type="password" {...register('currentPassword')} />
                 {errors.confirmNewPassword && <p className="text-sm text-destructive">{errors.confirmNewPassword.message}</p>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input id="newPassword" type="password" {...register('newPassword')} className={errors.newPassword ? 'border-destructive' : ''} />
                  {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                  <Input id="confirmNewPassword" type="password" {...register('confirmNewPassword')} />
                </div>
              </div>
            </div>
          </section>
          
          {/* Notification Settings Section */}
          <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center">
                <Bell className="mr-2 h-5 w-5 text-muted-foreground" />Notification Settings
            </h3>
            <div className="flex items-center justify-between p-4 border rounded-md">
                <div>
                    <Label htmlFor="enableNotifications" className="text-base">Enable Email Notifications</Label>
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
                        />
                    )}
                />
            </div>
          </section>

        </CardContent>
        <CardFooter className="pt-6 border-t">
          <Button type="submit" disabled={isLoading} size="lg" className="w-full sm:w-auto ml-auto bg-primary hover:bg-primary/90 text-primary-foreground">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving...
              </>
            ) : (
              <><Save className="mr-2 h-5 w-5" /> Save Changes</>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
