
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
import { allSpecialties as predefinedSpecialties, mockCoaches } from '@/data/mock'; 
import { debounce } from 'lodash';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import { uploadProfileImage } from '@/services/imageUpload';
import { useRouter } from 'next/navigation';

// Helper keys for localStorage
const PENDING_COACH_PROFILE_KEY = 'coachconnect-pending-coach-profile';

const coachRegistrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'), // Display only, pre-filled
  bio: z.string().min(50, 'Bio must be at least 50 characters.'),
  selectedSpecialties: z.array(z.string()).min(1, 'Please select at least one specialty.'),
  customSpecialty: z.string().optional(),
  profileImageUrl: z.string().url('Profile image URL must be a valid URL.').optional().or(z.literal('')),
  certifications: z.string().optional(), 
  // Premium Features
  websiteUrl: z.string().url('Invalid URL for website.').optional().or(z.literal('')),
  introVideoUrl: z.string().url('Invalid URL for intro video.').optional().or(z.literal('')),
  socialLinkPlatform: z.string().optional(),
  socialLinkUrl: z.string().url('Invalid URL for social link.').optional().or(z.literal('')),
});

type CoachRegistrationFormData = z.infer<typeof coachRegistrationSchema>;

export default function CoachRegistrationPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [suggestedSpecialties, setSuggestedSpecialties] = useState<string[]>([]);
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>(predefinedSpecialties);
  
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<File | null>(null);

  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const { control, register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<CoachRegistrationFormData>({
    resolver: zodResolver(coachRegistrationSchema),
    defaultValues: {
      name: '',
      email: '',
      selectedSpecialties: [],
      profileImageUrl: '',
    }
  });

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ title: "Authentication Required", description: "Please sign up or log in as a coach first.", variant: "destructive" });
      router.push('/signup');
      return;
    }
    if (user) {
      // Attempt to pre-fill from localStorage if pending coach profile exists
      try {
        const pendingProfileStr = localStorage.getItem(PENDING_COACH_PROFILE_KEY);
        if (pendingProfileStr) {
          const pendingProfile = JSON.parse(pendingProfileStr);
          reset({ // Use reset to set multiple form values
            name: pendingProfile.name || user.name || '',
            email: pendingProfile.email || user.email || '',
            selectedSpecialties: [], // Keep specialties empty initially
            profileImageUrl: '',
            // other fields if stored
          });
          localStorage.removeItem(PENDING_COACH_PROFILE_KEY); // Clear after use
        } else {
           reset({
            name: user.name || '',
            email: user.email || '',
            selectedSpecialties: [],
            profileImageUrl: '',
          });
        }
      } catch (e) {
        console.error("Error reading pending coach profile from localStorage", e);
        reset({ // Fallback to user context if localStorage fails
          name: user.name || '',
          email: user.email || '',
          selectedSpecialties: [],
          profileImageUrl: '',
        });
      }
    }
  }, [user, authLoading, router, toast, reset]);


  const bioValue = watch('bio');

  const fetchSuggestions = useCallback(
    debounce(async (bioText: string) => {
      if (bioText && bioText.length >= 50) {
        setIsAiLoading(true);
        try {
          const input: SuggestCoachSpecialtiesInput = { bio: bioText };
          await new Promise(resolve => setTimeout(resolve, 1000));
          const simulatedResponse: SuggestCoachSpecialtiesOutput = {
             specialties: predefinedSpecialties.filter(s => bioText.toLowerCase().includes(s.split(" ")[0].toLowerCase())).slice(0,3), 
             keywords: ['keyword1', 'keyword2', 'keyword3']
          };

          setSuggestedSpecialties(simulatedResponse.specialties);
          setSuggestedKeywords(simulatedResponse.keywords);
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
    }, 1000), 
    [setValue, toast, control]
  );

  useEffect(() => {
    if (bioValue) {
      fetchSuggestions(bioValue);
    }
  }, [bioValue, fetchSuggestions]);
  
  const onSubmit: SubmitHandler<CoachRegistrationFormData> = async (data) => {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in to register as a coach.", variant: "destructive"});
      router.push('/login');
      return;
    }
    setIsSubmitting(true);

    let finalProfileImageUrl = data.profileImageUrl;
    if (selectedFileForUpload) {
        try {
            finalProfileImageUrl = await uploadProfileImage(selectedFileForUpload, user.id);
            setValue('profileImageUrl', finalProfileImageUrl);
            setImagePreviewUrl(null); 
            setSelectedFileForUpload(null);
        } catch (uploadError: any) {
            toast({ title: "Image Upload Failed", description: uploadError.message, variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
    }
    
    const registrationData = { ...data, profileImageUrl: finalProfileImageUrl, id: user.id, firebaseUid: user.id };
    console.log('Coach registration data:', registrationData);
    // In a real app: Save registrationData to Firestore, keyed by user.id (Firebase UID)
    
    // For mock: Add to mockCoaches or similar
    const existingCoachIndex = mockCoaches.findIndex(c => c.id === user.id);
    const coachEntry = {
        id: user.id,
        name: data.name,
        email: data.email,
        bio: data.bio,
        specialties: data.selectedSpecialties,
        keywords: suggestedKeywords, 
        profileImageUrl: finalProfileImageUrl,
        certifications: data.certifications?.split(',').map(c => c.trim()).filter(Boolean) || [],
        subscriptionTier: data.websiteUrl || data.introVideoUrl ? 'premium' : 'free', 
        websiteUrl: data.websiteUrl,
        introVideoUrl: data.introVideoUrl,
        socialLinks: data.socialLinkPlatform && data.socialLinkUrl ? [{ platform: data.socialLinkPlatform, url: data.socialLinkUrl }] : [],
        location: "Remote" 
    };
    if (existingCoachIndex > -1) {
        mockCoaches[existingCoachIndex] = coachEntry;
    } else {
        mockCoaches.push(coachEntry);
    }


    await new Promise(resolve => setTimeout(resolve, 2000)); 
    setIsSubmitting(false);
    toast({
      title: "Coach Profile Submitted!",
      description: "Your coach profile has been created/updated. It may be subject to admin review.",
      action: <CheckCircle2 className="text-green-500" />,
    });
    router.push('/dashboard/coach'); 
  };

  const handleAddCustomSpecialty = () => {
    const customSpecialty = control._formValues.customSpecialty?.trim();
    if (customSpecialty && !availableSpecialties.includes(customSpecialty)) {
      setAvailableSpecialties(prev => [...prev, customSpecialty]);
      setValue('selectedSpecialties', [...(control._formValues.selectedSpecialties || []), customSpecialty]);
      setValue('customSpecialty', ''); 
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFileForUpload(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFileForUpload(null);
      setImagePreviewUrl(null);
    }
  };

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /> Loading...</div>;
  }
  if (!user) {
    // This case should ideally be caught by the useEffect redirect, but as a fallback:
    return <div className="flex justify-center items-center min-h-screen">Please log in to continue.</div>;
  }


  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <UserPlus className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">Complete Your Coach Profile</CardTitle>
          <CardDescription>
            You've created an account! Now, let's build your coach profile to help clients find you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Personal Information */}
            <section className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">Your Details</h3>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" {...register('name')} placeholder="e.g., Dr. Jane Doe" className={errors.name ? 'border-destructive' : ''} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address (from signup)</Label>
                <Input id="email" type="email" {...register('email')} readOnly className={`bg-muted/50 ${errors.email ? 'border-destructive' : ''}`} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
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

              <div className="space-y-1">
                <Label htmlFor="profileImageFile">Profile Image</Label>
                 <div className="flex items-center gap-2">
                    <UploadCloud className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <Input 
                        id="profileImageFile" 
                        type="file" 
                        accept="image/png, image/jpeg, image/gif, image/webp"
                        onChange={handleImageUpload}
                        className="flex-grow"
                    />
                </div>
                {imagePreviewUrl && (
                  <div className="mt-2 relative w-32 h-32">
                    <Image
                        src={imagePreviewUrl}
                        alt="Profile preview"
                        fill
                        className="rounded-md object-cover border"
                        data-ai-hint="profile image preview"
                    />
                  </div>
                )}
                {errors.profileImageUrl && <p className="text-sm text-destructive">{errors.profileImageUrl.message}</p>}
                <p className="text-xs text-muted-foreground">
                  Upload an image. For best results, use a square image.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="certifications">Certifications (Optional, comma-separated)</Label>
                <Input id="certifications" {...register('certifications')} placeholder="e.g., CPC, ICF Accredited" />
              </div>
            </section>

            <section className="space-y-6 p-6 bg-primary/5 rounded-lg border border-primary/20">
                <Alert variant="default" className="bg-transparent border-0 p-0">
                    <AlertTitle className="text-xl font-semibold text-primary flex items-center">
                        <Crown className="mr-2 h-6 w-6 text-yellow-500" /> 
                        Supercharge Your Profile with Premium!
                    </AlertTitle>
                    <AlertDescription className="text-muted-foreground mt-2">
                        Unlock powerful features like a Premium Badge, link your personal website, embed an engaging intro video, 
                        and connect your social media for <strong className="font-semibold text-foreground/90">only £9.99/month</strong>. 
                        Attract more clients and stand out from the crowd.
                    </AlertDescription>
                    <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        <Button asChild variant="default" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                            <Link href="/pricing">Get Premium</Link> 
                        </Button>
                        <Button asChild variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/10">
                            <Link href="/pricing">Explore premium benefits</Link>
                        </Button>
                    </div>
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
                Your profile information will be saved. Some features or listings may be subject to admin review.
              </AlertDescription>
            </Alert>

            <Button type="submit" disabled={isSubmitting || isAiLoading || authLoading} size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSubmitting || authLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Saving Profile...
                </>
              ) : (
                'Save Coach Profile'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
