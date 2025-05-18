
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
import { Loader2, UserCircle, Lightbulb, Save, Link as LinkIcon, Crown, Globe, Video, PlusCircle, Tag, MapPin, CheckCircle2, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { suggestCoachSpecialties, type SuggestCoachSpecialtiesInput, type SuggestCoachSpecialtiesOutput } from '@/ai/flows/suggest-coach-specialties';
import type { FirestoreUserProfile } from '@/types';
import { debounce } from 'lodash';
import Link from 'next/link';
import NextImage from 'next/image';
import { useAuth } from '@/lib/auth';
import { getUserProfile, setUserProfile } from '@/lib/firestore';
import { Badge } from '@/components/ui/badge';

const coachProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.').optional(), // Display only
  bio: z.string().min(50, 'Bio must be at least 50 characters to trigger AI suggestions.'),
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

type CoachProfileFormData = z.infer<typeof coachProfileSchema>;

const allSpecialtiesList = [
  'Career Coaching', 'Personal Development', 'Mindfulness Coaching', 'Executive Coaching',
  'Leadership Coaching', 'Business Strategy Coaching', 'Wellness Coaching', 'Relationship Coaching',
  'Stress Management Coaching', 'Health and Fitness Coaching', 'Spiritual Coaching',
  'Financial Coaching', 'Parenting Coaching', 'Academic Coaching', 'Performance Coaching',
];

export default function CoachProfilePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [suggestedSpecialtiesState, setSuggestedSpecialtiesState] = useState<string[]>([]);
  const [suggestedKeywordsState, setSuggestedKeywordsState] = useState<string[]>([]);
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>(allSpecialtiesList);
  const [currentCoach, setCurrentCoach] = useState<FirestoreUserProfile | null>(null);
  const { user, loading: authLoading } = useAuth();
  
  const { toast } = useToast();
  const { control, register, handleSubmit, watch, setValue, reset, getValues, formState: { errors } } = useForm<CoachProfileFormData>({
    resolver: zodResolver(coachProfileSchema),
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

  const bioValue = watch('bio');
  const profileImageUrlValue = watch('profileImageUrl');

  useEffect(() => {
    if (authLoading || !user) return;

    const fetchCoachData = async () => {
      setIsSubmitting(true);
      const coachData = await getUserProfile(user.id);
      if (coachData && coachData.role === 'coach') {
        setCurrentCoach(coachData);
        reset({
          name: coachData.name,
          email: coachData.email || user?.email || '',
          bio: coachData.bio || '',
          selectedSpecialties: coachData.specialties || [],
          keywords: coachData.keywords?.join(', ') || '',
          profileImageUrl: coachData.profileImageUrl || '',
          certifications: coachData.certifications?.join(', ') || '',
          location: coachData.location || '',
          websiteUrl: coachData.websiteUrl || '',
          introVideoUrl: coachData.introVideoUrl || '',
          socialLinkPlatform: coachData.socialLinks?.[0]?.platform || '',
          socialLinkUrl: coachData.socialLinks?.[0]?.url || '',
        });
        const allSpecs = new Set([...allSpecialtiesList, ...(coachData.specialties || [])]);
        setAvailableSpecialties(Array.from(allSpecs));
      } else if(coachData && coachData.role !== 'coach'){
        toast({ title: "Not a Coach", description: "This dashboard is for coaches.", variant: "destructive" });
        // router.push('/dashboard/user'); // Consider redirecting if not a coach
      } else if (!coachData && user.role === 'coach') {
        // User is authenticated as a coach, but no Firestore profile exists yet.
        // This might happen if the initial profile creation in auth.tsx failed or was interrupted.
        // Pre-fill with whatever we have from auth.
        console.warn(`[CoachProfilePage] No existing Firestore profile for coach ${user.id}. Pre-filling from auth context.`);
        reset({
          name: user.name || '',
          email: user.email || '',
        });
      }
      setIsSubmitting(false);
    };
    fetchCoachData();
  }, [reset, user, authLoading, toast]);

  const fetchSuggestions = useCallback(
    debounce(async (bioText: string) => {
      if (bioText && bioText.length >= 50) {
        setIsAiLoading(true);
        setSuggestedKeywordsState([]);
        setSuggestedSpecialtiesState([]);
        try {
          const input: SuggestCoachSpecialtiesInput = { bio: bioText };
          console.log("Calling AI suggestCoachSpecialties with bio (first 100 chars):", bioText.substring(0,100));
          const response: SuggestCoachSpecialtiesOutput = await suggestCoachSpecialties(input);
          console.log("AI suggestCoachSpecialties response:", response);
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

  const onSubmit: SubmitHandler<CoachProfileFormData> = async (data) => {
    if (!user || !currentCoach) { // currentCoach check ensures we are updating an existing profile
        toast({ title: "Error", description: "User not authenticated or coach data missing.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);

    const keywordsArray = data.keywords?.split(',').map(k => k.trim()).filter(Boolean) || [];
    const certificationsArray = data.certifications?.split(',').map(c => c.trim()).filter(Boolean) || [];

    const profileToSave: Partial<Omit<FirestoreUserProfile, 'id' | 'email' | 'role' | 'createdAt' | 'subscriptionTier' | 'status'>> = { 
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
        // updatedAt is handled by setUserProfile
    };

    try {
        await setUserProfile(user.id, profileToSave);
        toast({
          title: "Profile Updated!",
          description: "Your profile changes have been saved successfully.",
          action: <Save className="text-green-500" />,
        });
    } catch (error: any) {
        console.error('Error updating coach profile in Firestore:', error);
        toast({ title: "Profile Save Error", description: `Could not save your profile. ${error.message || 'Please try again.'}`, variant: "destructive" });
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

  if (authLoading || (!user && !currentCoach)) { // Show loader if auth is loading or if no user and no currentCoach (initial state)
    return <div className="flex justify-center items-center h-full min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /> Loading profile...</div>;
  }

  const isPremium = currentCoach?.subscriptionTier === 'premium';

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-2xl flex items-center"><UserCircle className="mr-3 h-7 w-7 text-primary"/>Edit Your Profile</CardTitle>
                <CardDescription>Keep your information current to attract the right clients.</CardDescription>
            </div>
            {currentCoach && (
              <Badge variant={isPremium ? "default" : "secondary"} className={isPremium ? "bg-yellow-500 text-white hover:bg-yellow-600" : ""}>
                  {isPremium && <Crown className="mr-2 h-4 w-4" />} {currentCoach.subscriptionTier?.toUpperCase()} Tier
              </Badge>
            )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Basic Information</h3>
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
              <div className="space-y-1">
                <Label htmlFor="bio">Your Bio (min. 50 characters for AI suggestions)</Label>
                <Textarea id="bio" {...register('bio')} rows={6} className={errors.bio ? 'border-destructive' : ''} />
                {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
              </div>
            </div>
          </section>

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
          
          <section>
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Professional Details</h3>
            <div className="space-y-4">
                <div className="space-y-1">
                    <Label>Specialties (select at least one)</Label>
                    <Controller
                    name="selectedSpecialties"
                    control={control}
                    render={({ field }) => (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-60 overflow-y-auto p-2 border rounded-md">
                        {availableSpecialties.sort().map((specialty) => (
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
                    <Button type="button" variant="outline" onClick={handleAddCustomSpecialty}><PlusCircle className="mr-2 h-4 w-4" />Add</Button>
                    </div>
                </div>

                <div className="space-y-1">
                    <Label htmlFor="keywords" className="flex items-center"><Tag className="mr-2 h-4 w-4 text-muted-foreground"/>Keywords (Comma-separated)</Label>
                    <Input id="keywords" {...register('keywords')} placeholder="e.g., leadership, wellness, executive coaching" />
                    {errors.keywords && <p className="text-sm text-destructive">{errors.keywords.message}</p>}
                     <p className="text-xs text-muted-foreground">Help clients find you with relevant keywords.</p>
                </div>
                
                <div className="space-y-1">
                    <Label htmlFor="certifications" className="flex items-center"><CheckCircle2 className="mr-2 h-4 w-4 text-muted-foreground"/>Certifications (Optional, comma-separated)</Label>
                    <Input id="certifications" {...register('certifications')} placeholder="e.g., CPC, ICF Accredited" />
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="location" className="flex items-center"><MapPin className="mr-2 h-4 w-4 text-muted-foreground"/>Location (Optional)</Label>
                    <Input id="location" {...register('location')} placeholder="e.g., New York, NY or Remote" />
                </div>
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-lg font-semibold">Premium Features</h3>
                {!isPremium && (
                    <Button variant="outline" size="sm" asChild className="border-yellow-500 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700">
                        <Link href="/pricing"><Crown className="mr-2 h-4 w-4 text-yellow-500" /> Upgrade to Premium</Link>
                    </Button>
                )}
            </div>
            <div className={`space-y-4 ${!isPremium ? 'opacity-60 cursor-not-allowed' : ''}`}>
                <div className="space-y-1">
                    <Label htmlFor="websiteUrl" className={!isPremium ? "text-muted-foreground" : ""}>Website URL</Label>
                     <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <Input id="websiteUrl" type="url" {...register('websiteUrl')} className={errors.websiteUrl ? 'border-destructive' : ''} disabled={!isPremium} placeholder="https://yourwebsite.com" />
                    </div>
                    {errors.websiteUrl && <p className="text-sm text-destructive">{errors.websiteUrl.message}</p>}
                     {!isPremium && <p className="text-xs text-muted-foreground">Available for Premium coaches.</p>}
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="introVideoUrl" className={!isPremium ? "text-muted-foreground" : ""}>Intro Video URL (e.g., YouTube)</Label>
                    <div className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-muted-foreground" />
                        <Input id="introVideoUrl" type="url" {...register('introVideoUrl')} className={errors.introVideoUrl ? 'border-destructive' : ''} disabled={!isPremium} placeholder="https://youtube.com/watch?v=yourvideo" />
                    </div>
                    {errors.introVideoUrl && <p className="text-sm text-destructive">{errors.introVideoUrl.message}</p>}
                    {!isPremium && <p className="text-xs text-muted-foreground">Available for Premium coaches.</p>}
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                    <Label htmlFor="socialLinkPlatform" className={!isPremium ? "text-muted-foreground" : ""}>Social Media Platform</Label>
                    <Input id="socialLinkPlatform" {...register('socialLinkPlatform')} disabled={!isPremium} placeholder="e.g., LinkedIn"/>
                    </div>
                    <div className="space-y-1">
                    <Label htmlFor="socialLinkUrl" className={!isPremium ? "text-muted-foreground" : ""}>Social Media URL</Label>
                    <div className="flex items-center gap-2">
                        <LinkIcon className="h-5 w-5 text-muted-foreground" />
                        <Input id="socialLinkUrl" type="url" {...register('socialLinkUrl')} className={errors.socialLinkUrl ? 'border-destructive' : ''} disabled={!isPremium} placeholder="https://linkedin.com/in/yourprofile" />
                    </div>
                    {errors.socialLinkUrl && <p className="text-sm text-destructive">{errors.socialLinkUrl.message}</p>}
                    </div>
                </div>
                 {!isPremium && <p className="text-xs text-muted-foreground mt-1">Social media links are available for Premium coaches.</p>}
            </div>
          </section>
          
          <Button type="submit" disabled={isSubmitting || isAiLoading || authLoading} size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            {isSubmitting || authLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving Changes...
              </>
            ) : (
              <><Save className="mr-2 h-5 w-5" /> Save Profile Changes</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
