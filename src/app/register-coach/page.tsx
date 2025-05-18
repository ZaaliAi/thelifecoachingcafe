
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
import { Loader2, UserPlus, Lightbulb, CheckCircle2, Link as LinkIcon, Crown, Globe, Video, MapPin, Tag, PlusCircle, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { suggestCoachSpecialties, type SuggestCoachSpecialtiesInput, type SuggestCoachSpecialtiesOutput } from '@/ai/flows/suggest-coach-specialties';
import { debounce } from 'lodash';
import Link from 'next/link';
import NextImage from 'next/image';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { setUserProfile, getUserProfile } from '@/lib/firestore';
import type { FirestoreUserProfile } from '@/types';
import { Badge } from '@/components/ui/badge';

const coachRegistrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'), // Will be read-only, populated from auth
  bio: z.string().min(50, 'Bio must be at least 50 characters for AI suggestions.'),
  selectedSpecialties: z.array(z.string()).min(1, 'Please select at least one specialty.'),
  customSpecialty: z.string().optional(),
  keywords: z.string().optional(),
  profileImageUrl: z.string().url('Profile image URL must be a valid URL.').optional().or(z.literal('')).nullable(),
  certifications: z.string().optional(),
  location: z.string().optional(),
  websiteUrl: z.string().url('Invalid URL for website.').optional().or(z.literal('')),
  introVideoUrl: z.string().url('Invalid URL for intro video.').optional().or(z.literal('')),
  socialLinkPlatform: z.string().optional(),
  socialLinkUrl: z.string().url('Invalid URL for social link.').optional().or(z.literal('')),
});

type CoachRegistrationFormData = z.infer<typeof coachRegistrationSchema>;

const allSpecialtiesList = [
  'Career Coaching', 'Personal Development', 'Mindfulness Coaching', 'Executive Coaching',
  'Leadership Coaching', 'Business Strategy Coaching', 'Wellness Coaching', 'Relationship Coaching',
  'Stress Management Coaching', 'Health and Fitness Coaching', 'Spiritual Coaching',
  'Financial Coaching', 'Parenting Coaching', 'Academic Coaching', 'Performance Coaching',
];

export default function CoachRegistrationPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [suggestedSpecialtiesState, setSuggestedSpecialtiesState] = useState<string[]>([]);
  const [suggestedKeywordsState, setSuggestedKeywordsState] = useState<string[]>([]);
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>(allSpecialtiesList);
  
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const { control, register, handleSubmit, watch, setValue, reset, getValues, formState: { errors } } = useForm<CoachRegistrationFormData>({
    resolver: zodResolver(coachRegistrationSchema),
    defaultValues: {
      name: '',
      email: '',
      bio: '',
      selectedSpecialties: [],
      keywords: '',
      profileImageUrl: '',
      location: '',
      certifications: '',
      websiteUrl: '',
      introVideoUrl: '',
      socialLinkPlatform: '',
      socialLinkUrl: '',
    }
  });

  const profileImageUrlValue = watch('profileImageUrl'); 

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ title: "Authentication Required", description: "Please sign up or log in first.", variant: "destructive" });
      router.push('/signup?role=coach'); // Ensure role is passed for correct signup flow
      return;
    }
    if (user && user.role !== 'coach') {
      toast({ title: "Access Denied", description: "This page is for coach profile completion.", variant: "destructive" });
      router.push('/dashboard/user'); // Or a generic dashboard
      return;
    }
    if (user) {
      const fetchProfile = async () => {
        setIsSubmitting(true); // Show loading while fetching
        const existingProfile = await getUserProfile(user.id);
        if (existingProfile) {
          reset({
            name: existingProfile.name || user.name || '',
            email: existingProfile.email || user.email || '', // Should always use user.email from auth
            bio: existingProfile.bio || '',
            selectedSpecialties: existingProfile.specialties || [],
            keywords: existingProfile.keywords?.join(', ') || '',
            profileImageUrl: existingProfile.profileImageUrl || '',
            certifications: existingProfile.certifications?.join(', ') || '',
            location: existingProfile.location || '',
            websiteUrl: existingProfile.websiteUrl || '',
            introVideoUrl: existingProfile.introVideoUrl || '',
            socialLinkPlatform: existingProfile.socialLinks?.[0]?.platform || '',
            socialLinkUrl: existingProfile.socialLinks?.[0]?.url || '',
          });
          const allSpecs = new Set([...allSpecialtiesList, ...(existingProfile.specialties || [])]);
          setAvailableSpecialties(Array.from(allSpecs));
        } else {
           // This case means auth.tsx didn't create the initial profile, which it should have.
           // For robustness, pre-fill from auth user.
           console.warn(`[RegisterCoachPage] No existing Firestore profile for coach ${user.id}. Pre-filling from auth context.`);
           reset({
            name: user.name || '',
            email: user.email || '',
          });
        }
        setIsSubmitting(false);
      };
      fetchProfile();
    }
  }, [user, authLoading, router, toast, reset]);

  const bioValue = watch('bio');

  const fetchSuggestions = useCallback(
    debounce(async (bioText: string) => {
      if (bioText && bioText.length >= 50) {
        setIsAiLoading(true);
        setSuggestedKeywordsState([]);
        setSuggestedSpecialtiesState([]);
        try {
          const input: SuggestCoachSpecialtiesInput = { bio: bioText };
          const response: SuggestCoachSpecialtiesOutput = await suggestCoachSpecialties(input);
          setSuggestedSpecialtiesState(response.specialties || []);
          setSuggestedKeywordsState(response.keywords || []);
        } catch (error) {
          console.error('Error fetching AI suggestions:', error);
          toast({ title: "AI Suggestion Error", description: "Could not fetch suggestions from AI.", variant: "destructive" });
        } finally {
          setIsAiLoading(false);
        }
      }
    }, 1000),
    [toast]
  );

  useEffect(() => {
    if (bioValue) {
      fetchSuggestions(bioValue);
    }
  }, [bioValue, fetchSuggestions]);

  const onSubmit: SubmitHandler<CoachRegistrationFormData> = async (data) => {
    if (!user || user.role !== 'coach') {
      toast({ title: "Authorization Error", description: "You must be logged in as a coach.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);

    const keywordsArray = data.keywords?.split(',').map(k => k.trim()).filter(Boolean) || [];
    const certificationsArray = data.certifications?.split(',').map(c => c.trim()).filter(Boolean) || [];
    
    const profileToSave: Partial<Omit<FirestoreUserProfile, 'id' | 'email' | 'role' | 'createdAt' | 'updatedAt' | 'status' | 'subscriptionTier'>> = {
        name: data.name,
        bio: data.bio,
        specialties: data.selectedSpecialties,
        keywords: keywordsArray,
        profileImageUrl: data.profileImageUrl || null,
        certifications: certificationsArray,
        location: data.location || null,
        websiteUrl: data.websiteUrl || null,
        introVideoUrl: data.introVideoUrl || null,
        socialLinks: data.socialLinkPlatform && data.socialLinkUrl ? [{ platform: data.socialLinkPlatform, url: data.socialLinkUrl }] : [],
    };

    try {
        console.log("[RegisterCoachPage] Calling setUserProfile with data (this is an update):", JSON.stringify(profileToSave, null, 2));
        await setUserProfile(user.id, profileToSave); 
        toast({
          title: "Coach Profile Saved!",
          description: "Your coach profile details have been updated successfully.",
          action: <CheckCircle2 className="text-green-500" />,
        });
        router.push('/dashboard/coach');
    } catch (error: any) {
        console.error('[RegisterCoachPage] Error saving coach profile to Firestore:', error);
        toast({ title: "Profile Save Error", 
        description: `Could not save your profile. ${error.message || 'Please try again.'}`, 
        variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleAddCustomSpecialty = () => {
    const customSpecialtyValue = getValues('customSpecialty')?.trim();
    if (customSpecialtyValue && !availableSpecialties.includes(customSpecialtyValue)) {
      setAvailableSpecialties(prev => [...prev, customSpecialtyValue].sort());
      setValue('selectedSpecialties', [...(getValues('selectedSpecialties') || []), customSpecialtyValue]);
      setValue('customSpecialty', '');
    }
  };

  const handleSelectSuggestedKeyword = (keyword: string) => {
    const currentKeywords = getValues('keywords') || "";
    const keywordsSet = new Set(currentKeywords.split(',').map(k => k.trim()).filter(Boolean));
    if (!keywordsSet.has(keyword)) {
      setValue('keywords', [...keywordsSet, keyword].join(', '));
    }
  };

  const handleSelectSuggestedSpecialty = (specialty: string) => {
    if (!availableSpecialties.includes(specialty)) {
      setAvailableSpecialties(prev => [...prev, specialty].sort());
    }
    const currentSelected = getValues('selectedSpecialties') || [];
    if (!currentSelected.includes(specialty)) {
      setValue('selectedSpecialties', [...currentSelected, specialty]);
    }
  };

  if (authLoading || !user || isSubmitting) { // Combined loading states
    return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /> Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <UserPlus className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">Complete Your Coach Profile</CardTitle>
          <CardDescription>
            Welcome, {getValues('name') || user.email}! Let's build your coach profile to help clients find you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
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

            <section className="space-y-6">
              <h3 className="text-lg font-semibold border-b pb-2">Profile Details</h3>
              
              <div className="space-y-2">
                <Label htmlFor="profileImageUrl">Profile Image URL (Optional)</Label>
                <div className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    <Input id="profileImageUrl" type="url" {...register('profileImageUrl')} placeholder="https://example.com/your-image.png" className={errors.profileImageUrl ? 'border-destructive' : ''}/>
                </div>
                {errors.profileImageUrl && <p className="text-sm text-destructive">{errors.profileImageUrl.message}</p>}
                <p className="text-xs text-muted-foreground">Don’t have an image URL? Send us your photo via email and we’ll handle the upload.</p>
                {profileImageUrlValue && z.string().url().safeParse(profileImageUrlValue).success && (
                  <div className="mt-2 relative w-32 h-32">
                    <NextImage src={profileImageUrlValue} alt="Profile preview" fill className="rounded-md object-cover border" data-ai-hint="person avatar" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Your Bio (min. 50 characters for AI suggestions)</Label>
                <Textarea id="bio" {...register('bio')} rows={6} placeholder="Tell us about your coaching philosophy, experience, and what makes you unique..." className={errors.bio ? 'border-destructive' : ''} />
                {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
              </div>

              { (bioValue && bioValue.length >= 50) && (
                <Alert variant="default" className="bg-accent/10 border-accent/30">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  <AlertTitle className="font-semibold text-primary">AI Suggestions Based on Your Bio</AlertTitle>
                  <AlertDescription className="space-y-3 text-foreground/80 mt-2">
                    {isAiLoading && <p className="text-sm flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Analyzing bio...</p>}
                    {!isAiLoading && suggestedKeywordsState.length === 0 && suggestedSpecialtiesState.length === 0 && <p className="text-sm">No new suggestions based on current bio, or AI is processing.</p>}
                    
                    {suggestedKeywordsState.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-1">Suggested Keywords (click to add):</p>
                        <div className="flex flex-wrap gap-2">
                          {suggestedKeywordsState.map(keyword => (
                            <Badge key={keyword} variant="outline" onClick={() => handleSelectSuggestedKeyword(keyword)} className="cursor-pointer hover:bg-primary/20">
                              <PlusCircle className="mr-1 h-3 w-3" /> {keyword}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {suggestedSpecialtiesState.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1">Suggested Specialties (click to select):</p>
                         <div className="flex flex-wrap gap-2">
                          {suggestedSpecialtiesState.map(specialty => (
                            <Badge key={specialty} variant="outline" onClick={() => handleSelectSuggestedSpecialty(specialty)} className="cursor-pointer hover:bg-primary/20">
                               <PlusCircle className="mr-1 h-3 w-3" /> {specialty}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
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
                      {availableSpecialties.sort().map((specialty) => (
                        <div key={specialty} className="flex items-center space-x-2">
                          <Checkbox
                            id={`specialty-reg-${specialty.replace(/\s+/g, '-')}`}
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
                          <Label htmlFor={`specialty-reg-${specialty.replace(/\s+/g, '-')}`} className="font-normal">{specialty}</Label>
                        </div>
                      ))}
                    </div>
                  )}
                />
                {errors.selectedSpecialties && <p className="text-sm text-destructive">{errors.selectedSpecialties.message}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <Input {...register('customSpecialty')} placeholder="Add custom specialty" className="flex-grow"/>
                  <Button type="button" variant="outline" onClick={handleAddCustomSpecialty}><PlusCircle className="mr-2 h-4 w-4" />Add</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="keywords" className="flex items-center"><Tag className="mr-2 h-4 w-4 text-muted-foreground"/>Keywords (comma-separated)</Label>
                <Input id="keywords" {...register('keywords')} placeholder="e.g., leadership, wellness, mindset, career change" className={errors.keywords ? 'border-destructive' : ''}/>
                {errors.keywords && <p className="text-sm text-destructive">{errors.keywords.message}</p>}
                 <p className="text-xs text-muted-foreground">Help clients find you by adding relevant keywords.</p>
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
                        <Input id="websiteUrl" type="url" {...register('websiteUrl')} placeholder="https://yourwebsite.com" className={errors.websiteUrl ? 'border-destructive' : ''} />
                    </div>
                    {errors.websiteUrl && <p className="text-sm text-destructive">{errors.websiteUrl.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="introVideoUrl">Intro Video URL (e.g., YouTube - Premium Feature)</Label>
                    <div className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-muted-foreground" />
                        <Input id="introVideoUrl" type="url" {...register('introVideoUrl')} placeholder="https://youtube.com/watch?v=yourvideo" className={errors.introVideoUrl ? 'border-destructive' : ''} />
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
                            <Input id="socialLinkUrl" type="url" {...register('socialLinkUrl')} placeholder="https://linkedin.com/in/yourprofile" className={errors.socialLinkUrl ? 'border-destructive' : ''}/>
                            </div>
                            {errors.socialLinkUrl && <p className="text-sm text-destructive">{errors.socialLinkUrl.message}</p>}
                        </div>
                    </div>
                </div>
            </section>

            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Profile Submission</AlertTitle>
              <AlertDescription>
                Your profile information will be saved. New coaches are typically reviewed by an admin before appearing publicly.
              </AlertDescription>
            </Alert>

            <Button type="submit" disabled={isSubmitting || isAiLoading || authLoading} size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              {isSubmitting || authLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Saving Profile...
                </>
              ) : (
                'Complete and Save Coach Profile'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
