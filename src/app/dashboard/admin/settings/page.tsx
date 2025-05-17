
"use client";

import { useState } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Settings, Save, Users, FileText, MessageSquare } from "lucide-react";
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const platformSettingsSchema = z.object({
  platformName: z.string().min(3, 'Platform name is too short.').optional(),
  adminEmail: z.string().email('Invalid admin email.').optional(),
  maintenanceMode: z.boolean().optional(),
  newCoachApproval: z.enum(['automatic', 'manual']).optional(),
  newBlogPostApproval: z.enum(['automatic', 'manual']).optional(),
  welcomeEmailTemplate: z.string().optional(),
});

type PlatformSettingsFormData = z.infer<typeof platformSettingsSchema>;

export default function AdminPlatformSettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Mock current platform settings
  const currentSettings = {
    platformName: "CoachConnect",
    adminEmail: "hello@thelifecoachingcafe.com",
    maintenanceMode: false,
    newCoachApproval: "manual" as const,
    newBlogPostApproval: "manual" as const,
    welcomeEmailTemplate: "Welcome to {{platformName}}! We're excited to have you."
  };

  const { register, handleSubmit, control, formState: { errors } } = useForm<PlatformSettingsFormData>({
    resolver: zodResolver(platformSettingsSchema),
    defaultValues: currentSettings,
  });

  const onSubmit: SubmitHandler<PlatformSettingsFormData> = async (data) => {
    setIsLoading(true);
    console.log('Updating platform settings:', data);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsLoading(false);
    toast({
      title: "Platform Settings Updated!",
      description: "Changes have been saved successfully.",
    });
  };

  return (
    <Card className="shadow-lg max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <Settings className="mr-3 h-7 w-7 text-primary" />
          Platform Settings
        </CardTitle>
        <CardDescription>Configure global settings for the CoachConnect platform.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-8">
          {/* General Settings */}
          <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">General</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <Label htmlFor="platformName">Platform Name</Label>
                <Input id="platformName" {...register('platformName')} />
                {errors.platformName && <p className="text-sm text-destructive">{errors.platformName.message}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="adminEmail">Default Admin Email</Label>
                <Input id="adminEmail" type="email" {...register('adminEmail')} />
                {errors.adminEmail && <p className="text-sm text-destructive">{errors.adminEmail.message}</p>}
              </div>
            </div>
             <div className="flex items-center justify-between p-4 border rounded-md mt-6">
                <div>
                    <Label htmlFor="maintenanceMode" className="text-base">Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">Temporarily disable public access to the site.</p>
                </div>
                <Controller
                    name="maintenanceMode"
                    control={control}
                    render={({ field }) => (
                        <Switch
                        id="maintenanceMode"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        />
                    )}
                />
            </div>
          </section>

          {/* Approval Flows */}
          <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Approval Workflows</h3>
            <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-md">
                    <div>
                        <Label htmlFor="newCoachApproval" className="text-base flex items-center"><Users className="mr-2 h-4 w-4"/>New Coach Registrations</Label>
                        <p className="text-sm text-muted-foreground">Set to manual for admin review or automatic.</p>
                    </div>
                    {/* This would be a Select component */}
                    <Input id="newCoachApproval" {...register('newCoachApproval')} placeholder="manual or automatic" className="w-32"/>
                </div>
                 <div className="flex items-center justify-between p-4 border rounded-md">
                    <div>
                        <Label htmlFor="newBlogPostApproval" className="text-base flex items-center"><FileText className="mr-2 h-4 w-4"/>New Blog Post Submissions</Label>
                        <p className="text-sm text-muted-foreground">Set to manual for admin review or automatic.</p>
                    </div>
                    <Input id="newBlogPostApproval" {...register('newBlogPostApproval')} placeholder="manual or automatic" className="w-32"/>
                </div>
            </div>
          </section>

           {/* Email Templates (Simplified) */}
          <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center">
                <MessageSquare className="mr-2 h-5 w-5 text-muted-foreground" />Email Templates
            </h3>
            <div className="space-y-1">
                <Label htmlFor="welcomeEmailTemplate">Welcome Email Content</Label>
                <Textarea id="welcomeEmailTemplate" {...register('welcomeEmailTemplate')} rows={5} placeholder="Use {{userName}} and {{platformName}} as placeholders."/>
                <p className="text-xs text-muted-foreground">Content for the email sent to new users.</p>
            </div>
          </section>

        </CardContent>
        <CardFooter className="pt-6 border-t">
          <Button type="submit" disabled={isLoading} size="lg" className="w-full sm:w-auto ml-auto bg-primary hover:bg-primary/90 text-primary-foreground">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving Settings...
              </>
            ) : (
              <><Save className="mr-2 h-5 w-5" /> Save Platform Settings</>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
