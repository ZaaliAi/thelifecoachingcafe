
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, UserPlus, Lightbulb, CheckCircle2, UploadCloud, Link as LinkIcon, Crown, Globe, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { suggestCoachSpecialties, type SuggestCoachSpecialtiesInput, type SuggestCoachSpecialtiesOutput } from '@/ai/flows/suggest-coach-specialties';
import { allSpecialties as predefinedSpecialties } from '@/data/mock'; // Predefined list
import { debounce } from 'lodash';
import Link from 'next/link';

const coachRegistrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
  bio: z.string().min(50, 'Bio must be at least 50 characters.'),
  selectedSpecialties: z.array(z.string()).min(1, 'Please select at least one specialty.'),
  customSpecialty: z.string().optional(),
  profileImageUrl: z.string().url('Invalid URL for profile image.').optional().or(z.literal('')),
  certifications: z.string().optional(), // Comma-separated string
  // Premium Features
  websiteUrl: z.string().url('Invalid URL for website.').optional().or(z.literal('')),
  introVideoUrl: z.string().url('Invalid URL for intro video.').optional().or(z.literal('')),
  socialLinkPlatform: z.string().optional(),
  socialLinkUrl: z.string().url('Invalid URL for social link.').optional().or(z.literal('')),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type CoachRegistrationFormData = z.infer<typeof coachRegistrationSchema>;

export default function CoachRegistrationPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [suggestedSpecialties, setSuggestedSpecialties] = useState<string[]>([]);
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>(predefinedSpecialties);
  
  const { toast } = useToast();
  const { control, register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CoachRegistrationFormData>({
    resolver: zodResolver(coachRegistrationSchema),
    defaultValues: {
      selectedSpecialties: [],
    }
  });

  const bioValue = watch('bio');

  const fetchSuggestions = useCallback(
    debounce(async (bioText: string) => {
      if (bioText && bioText.length >= 50) {
        setIsAiLoading(true);
        try {
          const input: SuggestCoachSpecialtiesInput = { bio: bioText };
          // This should be a server action or API call
          // const response = await suggestCoachSpecialties(input);
          // Simulate AI call
          await new Promise(resolve => setTimeout(resolve, 1000));
          const simulatedResponse: SuggestCoachSpecialtiesOutput = {
             specialties: predefinedSpecialties.filter(s => bioText.toLowerCase().includes(s.split(" ")[0].toLowerCase())).slice(0,3), // Mock suggestion
             keywords: ['keyword1', 'keyword2', 'keyword3'] // Mock keywords
          };

          setSuggestedSpecialties(simulatedResponse.specialties);
          setSuggestedKeywords(simulatedResponse.keywords);
          // Update form with suggested specialties if not already selected
          const currentSelected = control._formValues.selectedSpecialties || [];
          const newSelected = Array.from(new Set([...currentSelected, ...simulatedResponse.specialties.filter(s => predefinedSpecialties.includes(s))]));
          setValue('selectedSpecialties', newSelected);

        } catch (error) {
          console.error('Error fetching AI suggestions:', error);
          toast({ title: "AI Suggestion Error", description: "Could not fetch suggestions from AI.", variant: "destructive" });
        } finally {
          setIsAiLoading(false);
        }
      }
    }, 1000), // Debounce time: 1 second
    [setValue, toast, control]
  );

  useEffect(() => {
    if (bioValue) {
      fetchSuggestions(bioValue);
    }
  }, [bioValue, fetchSuggestions]);
  
  const onSubmit: SubmitHandler<CoachRegistrationFormData> = async (data) => {
    setIsLoading(true);
    // In a real app, this would send data to a backend for registration and admin approval.
    console.log('Coach registration data:', data);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
    setIsLoading(false);
    toast({
      title: "Registration Submitted!",
      description: "Your application has been submitted for review. We'll be in touch soon.",
      action: <CheckCircle2 className="text-green-500" />,
    });
    // Reset form or redirect
  };

  const handleAddCustomSpecialty = () => {
    const customSpecialty = control._formValues.customSpecialty?.trim();
    if (customSpecialty && !availableSpecialties.includes(customSpecialty)) {
      setAvailableSpecialties(prev => [...prev, customSpecialty]);
      setValue('selectedSpecialties', [...(control._formValues.selectedSpecialties || []), customSpecialty]);
      setValue('customSpecialty', ''); // Clear input
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <UserPlus className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">Become a Coach</CardTitle>
          <CardDescription>
            Join CoachConnect and help others achieve their goals. Fill out the form below to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Personal Information */}
            <section className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">Account Information</h3>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" {...register('name')} placeholder="e.g., Dr. Jane Doe" className={errors.name ? 'border-destructive' : ''} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" {...register('email')} placeholder="you@example.com" className={errors.email ? 'border-destructive' : ''} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" {...register('password')} className={errors.password ? 'border-destructive' : ''} />
                  {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input id="confirmPassword" type="password" {...register('confirmPassword')} className={errors.confirmPassword ? 'border-destructive' : ''} />
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
                </div>
              </div>
            </section>
            
            {/* Profile Details */}
            <section className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">Profile Details</h3>
              <div className="space-y-2">
                <Label htmlFor="bio">Your Bio (min. 50 characters)</Label>
                <Textarea id="bio" {...register('bio')} rows={6} placeholder="Tell us about your coaching philosophy, experience, and what makes you unique..." className={errors.bio ? 'border-destructive' : ''} />
                {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
              </div>

              { (isAiLoading || suggestedKeywords.length > 0 || suggestedSpecialties.length > 0) && (
                <Alert variant="default" className="bg-accent/20">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  <AlertTitle className="font-semibold">AI Suggestions Based on Your Bio</AlertTitle>
                  <AlertDescription className="space-y-1">
                    {isAiLoading && <p className="text-sm flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Analyzing bio...</p>}
                    {suggestedKeywords.length > 0 && <p className="text-sm">Consider these keywords: {suggestedKeywords.join(', ')}</p>}
                    {suggestedSpecialties.length > 0 && <p className="text-sm">Suggested specialties: {suggestedSpecialties.join(', ')}</p>}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>Specialties (select at least one)</Label>
                <Controller
                  name="selectedSpecialties"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-60 overflow-y-auto p-2 border rounded-md">
                      {availableSpecialties.map((specialty) => (
                        <div key={specialty} className="flex items-center space-x-2">
                          <Checkbox
                            id={`specialty-${specialty}`}
                            checked={field.value?.includes(specialty)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...(field.value || []), specialty])
                                : field.onChange(
                                    (field.value || []).filter(
                                      (value) => value !== specialty
                                    )
                                  );
                            }}
                          />
                          <Label htmlFor={`specialty-${specialty}`} className="font-normal">{specialty}</Label>
                        </div>
                      ))}
                    </div>
                  )}
                />
                {errors.selectedSpecialties && <p className="text-sm text-destructive">{errors.selectedSpecialties.message}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <Input {...register('customSpecialty')} placeholder="Add custom specialty" className="flex-grow"/>
                  <Button type="button" variant="outline" onClick={handleAddCustomSpecialty}>Add</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="profileImageUrl">Profile Image URL (Optional)</Label>
                <div className="flex items-center gap-2">
                  <UploadCloud className="h-5 w-5 text-muted-foreground" />
                  <Input id="profileImageUrl" {...register('profileImageUrl')} placeholder="https://example.com/your-image.png" className={errors.profileImageUrl ? 'border-destructive' : ''} />
                </div>
                {errors.profileImageUrl && <p className="text-sm text-destructive">{errors.profileImageUrl.message}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="certifications">Certifications (Optional, comma-separated)</Label>
                <Input id="certifications" {...register('certifications')} placeholder="e.g., CPC, ICF Accredited" />
              </div>
            </section>

            {/* Premium Features Encouragement */}
            <section className="space-y-6 p-6 bg-primary/5 rounded-lg border border-primary/20">
                <Alert variant="default" className="bg-transparent border-0 p-0">
                    <AlertTitle className="text-xl font-semibold text-primary flex items-center">
                        <Crown className="mr-2 h-6 w-6 text-yellow-500" /> 
                        Supercharge Your Profile with Premium!
                    </AlertTitle>
                    <AlertDescription className="text-muted-foreground mt-2">
                        Unlock powerful features like a Premium Badge on your profile, link your personal website, embed an engaging intro video, and connect your social media. Attract more clients and stand out from the crowd.
                    </AlertDescription>
                    <Button asChild variant="outline" size="sm" className="mt-4 border-primary text-primary hover:bg-primary/10">
                        <Link href="/pricing">Explore Premium Benefits</Link>
                    </Button>
                </Alert>

                <div className="space-y-2">
                    <Label htmlFor="websiteUrl">Your Personal Website (Premium Feature)</Label>
                    <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <Input id="websiteUrl" {...register('websiteUrl')} placeholder="https://yourwebsite.com" className={errors.websiteUrl ? 'border-destructive' : ''} />
                    </div>
                    {errors.websiteUrl && <p className="text-sm text-destructive">{errors.websiteUrl.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="introVideoUrl">Intro Video URL (e.g., YouTube - Premium Feature)</Label>
                    <div className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-muted-foreground" />
                        <Input id="introVideoUrl" {...register('introVideoUrl')} placeholder="https://youtube.com/watch?v=yourvideo" className={errors.introVideoUrl ? 'border-destructive' : ''} />
                    </div>
                    {errors.introVideoUrl && <p className="text-sm text-destructive">{errors.introVideoUrl.message}</p>}
                </div>
                
                <div>
                    <Label className="block mb-2">Social Media Link (Premium Feature)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Input id="socialLinkPlatform" {...register('socialLinkPlatform')} placeholder="e.g., LinkedIn, Instagram" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                            <LinkIcon className="h-5 w-5 text-muted-foreground" />
                            <Input id="socialLinkUrl" {...register('socialLinkUrl')} placeholder="https://linkedin.com/in/yourprofile" className={errors.socialLinkUrl ? 'border-destructive' : ''}/>
                            </div>
                            {errors.socialLinkUrl && <p className="text-sm text-destructive">{errors.socialLinkUrl.message}</p>}
                        </div>
                    </div>
                </div>
            </section>
            
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Admin Review</AlertTitle>
              <AlertDescription>
                Your registration will be reviewed by an administrator before your profile goes live.
              </AlertDescription>
            </Alert>

            <Button type="submit" disabled={isLoading || isAiLoading} size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Registration'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
