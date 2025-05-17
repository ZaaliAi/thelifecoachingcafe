
"use client";

// This page can be very similar to User Settings for now,
// potentially with coach-specific settings like availability, payment info in the future.
// For this iteration, it will mirror the UserSettingsPage structure.

import { useState } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Settings, Save, ShieldCheck, Bell, CalendarDays } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
// import { useAuth } from '@/lib/auth';

const coachSettingsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').optional(), // From profile
  email: z.string().email('Invalid email address.').optional(), // Display only
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.').optional(),
  confirmNewPassword: z.string().optional(),
  enableEmailNotifications: z.boolean().optional(),
  availabilityStatus: z.enum(["available", "busy", "on_vacation"]).optional(), // Coach-specific
}).refine(data => {
    if (data.newPassword && !data.currentPassword) return false;
    if (data.newPassword && data.newPassword !== data.confirmNewPassword) return false;
    return true;
}, {
  message: "New passwords don't match or current password missing.",
  path: ["confirmNewPassword"],
});

type CoachSettingsFormData = z.infer<typeof coachSettingsSchema>;

export default function CoachSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  // const { user } = useAuth();
  const { toast } = useToast();

  // Mock current coach data
  const currentCoach = { name: "Coach Example", email: "coach@example.com", enableEmailNotifications: true, availabilityStatus: "available" as const };

  const { register, handleSubmit, control, formState: { errors } } = useForm<CoachSettingsFormData>({
    resolver: zodResolver(coachSettingsSchema),
    defaultValues: {
        name: currentCoach.name,
        email: currentCoach.email,
        enableEmailNotifications: currentCoach.enableEmailNotifications,
        availabilityStatus: currentCoach.availabilityStatus,
    }
  });

  const onSubmit: SubmitHandler<CoachSettingsFormData> = async (data) => {
    setIsLoading(true);
    console.log('Updating coach settings:', data);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    toast({
      title: "Settings Updated!",
      description: "Your coach settings have been saved successfully.",
    });
  };

  return (
    <Card className="shadow-lg max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <Settings className="mr-3 h-7 w-7 text-primary" />
          Coach Account Settings
        </CardTitle>
        <CardDescription>Manage your account details, password, notifications, and availability.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-8">
          {/* Basic Info (from profile, mostly display) */}
          <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Basic Information</h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name">Display Name (Editable in Profile)</Label>
                <Input id="name" {...register('name')} readOnly className="bg-muted/50" />
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
                    <Label htmlFor="enableEmailNotifications" className="text-base">Enable Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive updates about client messages, blog status, etc.</p>
                </div>
                <Controller
                    name="enableEmailNotifications"
                    control={control}
                    render={({ field }) => (
                        <Switch
                        id="enableEmailNotifications"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        />
                    )}
                />
            </div>
          </section>

          {/* Availability Settings - Coach Specific */}
           <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center">
                <CalendarDays className="mr-2 h-5 w-5 text-muted-foreground" />Availability Status
            </h3>
            <div className="space-y-1">
                <Label htmlFor="availabilityStatus">Set your current availability</Label>
                {/* This would be a Select component in a real app */}
                <Input id="availabilityStatus" {...register('availabilityStatus')} placeholder="e.g., available, busy, on_vacation" />
                <p className="text-xs text-muted-foreground">This status might be displayed on your profile.</p>
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
              <><Save className="mr-2 h-5 w-5" /> Save Coach Settings</>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
