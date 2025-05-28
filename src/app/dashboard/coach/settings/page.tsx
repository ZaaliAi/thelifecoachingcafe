
"use client";

import { useState, useEffect } from 'react';
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
import { useAuth } from '@/lib/auth'; // Step 1: Import useAuth
import { getUserProfile } from '@/lib/firestore'; // Step 1: Import getUserProfile
import type { FirestoreUserProfile } from '@/types';

const coachSettingsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').optional(),
  email: z.string().email('Invalid email address.').optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.').optional(),
  confirmNewPassword: z.string().optional(),
  enableEmailNotifications: z.boolean().optional(),
  availabilityStatus: z.enum(["available", "busy", "on_vacation"]).optional(),
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
  const [isFetchingData, setIsFetchingData] = useState(true);
  const { user } = useAuth(); // Step 1: Use useAuth
  const { toast } = useToast();

  // State to hold the coach's current data
  const [currentCoach, setCurrentCoach] = useState<Partial<FirestoreUserProfile & { enableEmailNotifications?: boolean; availabilityStatus?: "available" | "busy" | "on_vacation" }>>({
    name: "",
    email: "",
    enableEmailNotifications: true,
    availabilityStatus: "available",
  });

  const { register, handleSubmit, control, formState: { errors }, reset } = useForm<CoachSettingsFormData>({
    resolver: zodResolver(coachSettingsSchema),
    defaultValues: currentCoach // Initialize with currentCoach state
  });

  // Step 1: Fetch real coach data
  useEffect(() => {
    const fetchCoachData = async () => {
      if (user && user.id) {
        setIsFetchingData(true);
        try {
          const profile = await getUserProfile(user.id);
          if (profile && profile.role === 'coach') {
            const coachDetails = {
              name: profile.name || '',
              email: profile.email || '',
              // TODO: Fetch these from Firestore if they are stored there, otherwise use defaults or remove if not needed
              enableEmailNotifications: (profile as any).enableEmailNotifications ?? true, 
              availabilityStatus: (profile as any).availabilityStatus ?? "available",
            };
            setCurrentCoach(coachDetails);
            reset(coachDetails); // Step 2: Use real data in the form
          } else {
            toast({ title: "Error", description: "Could not load coach profile.", variant: "destructive" });
          }
        } catch (error) {
          console.error("Failed to fetch coach settings:", error);
          toast({ title: "Error", description: "Could not load your settings.", variant: "destructive" });
        } finally {
          setIsFetchingData(false);
        }
      } else if (user === null) { // Explicitly check if user is null (not just undefined during initial load)
        setIsFetchingData(false);
        toast({ title: "Not Authenticated", description: "Please log in to view your settings.", variant: "destructive" });
      }
    };

    fetchCoachData();
  }, [user, reset, toast]);

  const onSubmit: SubmitHandler<CoachSettingsFormData> = async (data) => {
    setIsLoading(true);
    console.log('Updating coach settings:', data);
    // TODO: Implement actual update logic for coach settings in Firestore
    // This should include password change, notification preferences, and availability status
    // For example, for password: if (data.newPassword && data.currentPassword) { await reauthenticateAndChangePassword(data.currentPassword, data.newPassword); }
    // For other settings: await setUserProfile(user.id, { enableEmailNotifications: data.enableEmailNotifications, availabilityStatus: data.availabilityStatus });
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    setIsLoading(false);
    toast({
      title: "Settings Updated! (Mock)",
      description: "Your coach settings have been notionally saved. Backend update pending.",
    });
  };
  
  if (isFetchingData) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Loading settings...</div>;
  }

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

           <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center">
                <CalendarDays className="mr-2 h-5 w-5 text-muted-foreground" />Availability Status
            </h3>
            <div className="space-y-1">
                <Label htmlFor="availabilityStatus">Set your current availability</Label>
                {/* In a real app, this might be a Select component. For now, using Input. */}
                {/* TODO: Replace with a Select component if distinct statuses are finalized */}
                <Controller
                    name="availabilityStatus"
                    control={control}
                    render={({ field }) => (
                        <select 
                            {...field} 
                            className="block w-full p-2 border rounded-md bg-background text-foreground"
                        >
                            <option value="available">Available</option>
                            <option value="busy">Busy</option>
                            <option value="on_vacation">On Vacation</option>
                        </select>
                    )}
                />
                <p className="text-xs text-muted-foreground">This status might be displayed on your profile.</p>
            </div>
          </section>

        </CardContent>
        <CardFooter className="pt-6 border-t">
          <Button type="submit" disabled={isLoading || isFetchingData} size="lg" className="w-full sm:w-auto ml-auto bg-primary hover:bg-primary/90 text-primary-foreground">
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
