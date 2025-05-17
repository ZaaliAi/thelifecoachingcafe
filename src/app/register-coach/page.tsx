
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
import { Loader2, UserPlus, Lightbulb, CheckCircle2, UploadCloud, Link as LinkIcon, Crown, Globe, Video, MapPin, Tag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { suggestCoachSpecialties, type SuggestCoachSpecialtiesInput, type SuggestCoachSpecialtiesOutput } from '@/ai/flows/suggest-coach-specialties';
import { debounce } from 'lodash';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import { uploadProfileImage } from '@/services/imageUpload';
import { useRouter } from 'next/navigation';
import { setUserProfile } from '@/lib/firestore'; 
import type { FirestoreUserProfile } from '@/types';


// Helper keys for localStorage
const PENDING_COACH_PROFILE_KEY = 'coachconnect-pending-coach-profile';

const coachRegistrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'), // Display only, pre-filled
  bio: z.string().min(50, 'Bio must be at least 50 characters.'),
  selectedSpecialties: z.array(z.string()).min(1, 'Please select at least one specialty.'),
  customSpecialty: z.string().optional(),
  keywords: z.string().optional(), // Comma-separated keywords
  profileImageUrl: z.string().url('Profile image URL must be a valid URL.').optional().or(z.literal('')),
  certifications: z.string().optional(),
  location: z.string().optional(), 
  // Premium Features
  websiteUrl: z.string().url('Invalid URL for website.').optional().or(z.literal('')),
  introVideoUrl: z.string().url('Invalid URL for intro video.').optional().or(z.literal('')),
  socialLinkPlatform: z.string().optional(),
  socialLinkUrl: z.string().url('Invalid URL for social link.').optional().or(z.literal('')),
});

type CoachRegistrationFormData = z.infer<typeof coachRegistrationSchema>;

// Define specialties locally
const allSpecialtiesList = [
  'Career Coaching',
  'Personal Development',
  'Mindfulness Coaching',
  'Executive Coaching',
  'Leadership Coaching',
  'Business Strategy Coaching',
  'Wellness Coaching',
  'Relationship Coaching',
  'Stress Management Coaching',
  'Health and Fitness Coaching',
  'Spiritual Coaching',
  'Financial Coaching',
  'Parenting Coaching',
  'Academic Coaching',
  'Performance Coaching',
];


export default function CoachRegistrationPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [suggestedSpecialtiesState, setSuggestedSpecialtiesState] = useState<string[]>([]);
  const [suggestedKeywordsState, setSuggestedKeywordsState] = useState<string[]>([]);
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>(allSpecialtiesList); 
  
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
      bio: '',
      selectedSpecialties: [],
      profileImageUrl: '',
      keywords: '',
      location: '',
      certifications: '',
      websiteUrl: '',
      introVideoUrl: '',
      socialLinkPlatform: '',
      socialLinkUrl: '',
    }
  });

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ title: "Authentication Required", description: "Please sign up or log in as a coach first.", variant: "destructive" });
      router.push('/signup?role=coach'); 
      return;
    }
    if (user) {
      let pendingName = user.name || '';
      let pendingEmail = user.email || '';
      try {
        const pendingProfileStr = localStorage.getItem(PENDING_COACH_PROFILE_KEY);
        if (pendingProfileStr) {
          const pendingProfile = JSON.parse(pendingProfileStr);
          pendingName = pendingProfile.name || pendingName;
          pendingEmail = user.email || pendingProfile.email || pendingEmail; 
        }
      } catch (e) {
        console.error("Error reading pending coach profile from localStorage", e);
      }
      reset({
        name: pendingName,
        email: pendingEmail, 
        bio: '',
        selectedSpecialties: [],
        profileImageUrl: '',
        keywords: '',
        location: '',
        certifications: '',
        websiteUrl: '',
        introVideoUrl: '',
        socialLinkPlatform: '',
        socialLinkUrl: '',
      });
    }
  }, [user, authLoading, router, toast, reset]);


  const bioValue = watch('bio');

  const fetchSuggestions = useCallback(
    debounce(async (bioText: string) => {
      if (bioText && bioText.length >= 50) {
        setIsAiLoading(true);
        try {
          const input: SuggestCoachSpecialtiesInput = { bio: bioText };
          const response: SuggestCoachSpecialtiesOutput = await suggestCoachSpecialties(input);
          setSuggestedSpecialtiesState(response.specialties || []);
          setSuggestedKeywordsState(response.keywords || []);
           if (response.keywords && response.keywords.length > 0 && !watch('keywords')) {
             setValue('keywords', response.keywords.join(', '));
          }
        } catch (error) {
          console.error('Error fetching AI suggestions:', error);
          toast({ title: "AI Suggestion Error", description: "Could not fetch suggestions from AI.", variant: "destructive" });
        } finally {
          setIsAiLoading(false);
        }
      }
    }, 1000), 
    [toast, setValue, watch]
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
            setImagePreviewUrl(finalProfileImageUrl); 
            setSelectedFileForUpload(null);
        } catch (uploadError: any) {
            toast({ title: "Image Upload Failed", description: uploadError.message, variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
    }
    
    const keywordsArray = data.keywords?.split(',').map(k => k.trim()).filter(Boolean) || [];
    const certificationsArray = data.certifications?.split(',').map(c => c.trim()).filter(Boolean) || [];

    const isAttemptingPremium = !!(data.websiteUrl || data.introVideoUrl || (data.socialLinkPlatform && data.socialLinkUrl));
    const subscriptionTier = isAttemptingPremium ? 'premium' : 'free';


    const profileToSave: Partial<FirestoreUserProfile> = {
        name: data.name,
        email: data.email, 
        bio: data.bio,
        role: 'coach', 
        specialties: data.selectedSpecialties,
        keywords: keywordsArray,
        profileImageUrl: finalProfileImageUrl || undefined, 
        certifications: certificationsArray,
        location: data.location || undefined,
        subscriptionTier: subscriptionTier, 
        websiteUrl: data.websiteUrl || undefined,
        introVideoUrl: data.introVideoUrl || undefined,
        socialLinks: data.socialLinkPlatform && data.socialLinkUrl ? [{ platform: data.socialLinkPlatform, url: data.socialLinkUrl }] : [],
    };

    try {
        await setUserProfile(user.id, profileToSave); 
        localStorage.removeItem(PENDING_COACH_PROFILE_KEY); 
        toast({
          title: "Coach Profile Submitted!",
          description: "Your coach profile has been created. It may be subject to admin review.",
          action: <CheckCircle2 className="text-green-500" />,
        });
        router.push('/dashboard/coach'); 
    } catch (error) {
        console.error('Error saving coach profile to Firestore:', error);
        toast({ title: "Profile Save Error", description: "Could not save your profile to the database.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleAddCustomSpecialty = () => {
    const customSpecialtyValue = watch('customSpecialty')?.trim();
    if (customSpecialtyValue && !availableSpecialties.includes(customSpecialtyValue)) {
      setAvailableSpecialties(prev => [...prev, customSpecialtyValue]);
      setValue('selectedSpecialties', [...(watch('selectedSpecialties') || []), customSpecialtyValue]);
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
      if (!user?.profileImageUrl) {
        setImagePreviewUrl(null);
      } else {
         setImagePreviewUrl(user.profileImageUrl); 
      }
    }
  };

  if (authLoading || !user) {
    return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /> Loading...</div>;
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

              { (isAiLoading || suggestedKeywordsState.length > 0 || suggestedSpecialtiesState.length > 0) && (
                <Alert variant="default" className="bg-accent/20 border-accent/50">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  <AlertTitle className="font-semibold text-primary">AI Suggestions Based on Your Bio</AlertTitle>
                  <AlertDescription className="space-y-1 text-foreground/80">
                    {isAiLoading && <p className="text-sm flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Analyzing bio...</p>}
                    {suggestedKeywordsState.length > 0 && <p className="text-sm">Suggested Keywords: <span className="font-medium">{suggestedKeywordsState.join(', ')}</span></p>}
                    {suggestedSpecialtiesState.length > 0 && <p className="text-sm">Suggested specialties: <span className="font-medium">{suggestedSpecialtiesState.join(', ')}</span></p>}
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
                            id={`specialty-${specialty.replace(/\s+/g, '-')}`}
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
                          <Label htmlFor={`specialty-${specialty.replace(/\s+/g, '-')}`} className="font-normal">{specialty}</Label>
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
                <Label htmlFor="keywords" className="flex items-center"><Tag className="mr-2 h-4 w-4 text-muted-foreground"/>Keywords (comma-separated)</Label>
                <Input id="keywords" {...register('keywords')} placeholder="e.g., leadership, wellness, mindset, career change" className={errors.keywords ? 'border-destructive' : ''}/>
                {errors.keywords && <p className="text-sm text-destructive">{errors.keywords.message}</p>}
                 <p className="text-xs text-muted-foreground">Help clients find you by adding relevant keywords.</p>
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
                  Upload a professional image. Square images work best.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="certifications" className="flex items-center"><CheckCircle2 className="mr-2 h-4 w-4 text-muted-foreground"/>Certifications (Optional, comma-separated)</Label>
                <Input id="certifications" {...register('certifications')} placeholder="e.g., CPC, ICF Accredited" />
              </div>

               <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-muted-foreground"/>Location (Optional)</Label>
                <Input id="location" {...register('location')} placeholder="e.g., New York, NY or Remote" className={errors.location ? 'border-destructive' : ''} />
                 {errors.location && <p className="text-sm text-destructive">{errors.location.message}</p>}
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
                Your profile information will be saved. Listing on the directory may be subject to admin review.
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
    

    