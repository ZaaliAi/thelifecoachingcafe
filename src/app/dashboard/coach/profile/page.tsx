"use client";

import { useState, useEffect, useCallback, type ChangeEvent } from 'react'; 
import { useForm, Controller, type SubmitHandler, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, UserCircle, Lightbulb, Save, Link as LinkIcon, Crown, Globe, Video, PlusCircle, Tag, MapPin, CheckCircle2, Image as ImageIcon, UploadCloud, Trash2, CalendarDays } from 'lucide-react'; 
import { useToast } from '@/hooks/use-toast';
import { suggestCoachSpecialties, type SuggestCoachSpecialtiesInput, type SuggestCoachSpecialtiesOutput } from '@/ai/flows/suggest-coach-specialties';
import type { FirestoreUserProfile } from '@/types';
import { debounce } from 'lodash';
import Link from 'next/link';
import NextImage from 'next/image';
import { useAuth } from '@/lib/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { setUserProfile } from '@/lib/firestore';
import { Badge } from '@/components/ui/badge';
import { uploadProfileImage } from '@/services/imageUpload'; 

const availabilitySlotSchema = z.object({
  day: z.string().min(1, 'Day is required.').max(50, 'Day seems too long.'),
  time: z.string().min(1, 'Time is required.').max(50, 'Time seems too long.'),
});

const coachProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.').optional(), 
  bio: z.string().min(50, 'Bio must be at least 50 characters to trigger AI suggestions.'),
  selectedSpecialties: z.array(z.string()).min(1, 'Please select at least one specialty.'),
  customSpecialty: z.string().optional(),
  keywords: z.string().optional(),
  profileImageUrl: z.string().url('Profile image URL must be a valid URL.').optional().or(z.literal('')).nullable(),
  certifications: z.string().optional(),
  location: z.string().optional(),
  websiteUrl: z.string().url('Invalid URL for website.').optional().or(z.literal('')).nullable(),
  introVideoUrl: z.string().url('Invalid URL for intro video.').optional().or(z.literal('')).nullable(),
  socialLinkPlatform: z.string().optional(),
  socialLinkUrl: z.string().url('Invalid URL for social link.').optional().or(z.literal('')).nullable(),
  availability: z.array(availabilitySlotSchema).optional().default([]),
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
  const [newSlotDay, setNewSlotDay] = useState(''); 
  const [newSlotTime, setNewSlotTime] = useState(''); 
  const [currentCoach, setCurrentCoach] = useState<FirestoreUserProfile | null>(null);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

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
      availability: [], 
    }
  });

  const { fields: availabilityFields, append: appendAvailability, remove: removeAvailability } = useFieldArray({
    control,
    name: "availability",
  });

  const bioValue = watch('bio');
  const profileImageUrlValue = watch('profileImageUrl');

  useEffect(() => {
    if (authLoading || !user) return;

    setIsSubmitting(true);
    const unsub = onSnapshot(doc(db, 'users', user.id),
      (docSnap) => {
        if (docSnap.exists()) {
          const coachData = { ...docSnap.data(), id: docSnap.id } as FirestoreUserProfile;
          if (coachData.role === 'coach') {
            setCurrentCoach(coachData);
            reset({
              name: coachData.name || '',
              email: coachData.email || user?.email || '',
              bio: coachData.bio || '',
              selectedSpecialties: Array.isArray(coachData.specialties) ? coachData.specialties : [],
              profileImageUrl: coachData.profileImageUrl || '',
              location: coachData.location || '',
              websiteUrl: coachData.websiteUrl || '',
              introVideoUrl: coachData.introVideoUrl || '',
              socialLinkPlatform: coachData.socialLinks?.[0]?.platform || '',
              socialLinkUrl: coachData.socialLinks?.[0]?.url || '',
              availability: Array.isArray(coachData.availability) ? coachData.availability : [],
            });
            setValue('keywords', Array.isArray(coachData.keywords) ? coachData.keywords.join(', ') : (coachData.keywords || ''));
            setValue('certifications', Array.isArray(coachData.certifications) ? coachData.certifications.join(', ') : (coachData.certifications || ''));
            if (coachData.profileImageUrl) {
              setImagePreviewUrl(coachData.profileImageUrl);
            } else {
              setImagePreviewUrl(null); // Clear preview if no image
            }
            const allSpecs = new Set([...allSpecialtiesList, ...(coachData.specialties || [])]);
            setAvailableSpecialties(Array.from(allSpecs));
          } else {
            console.warn(`[CoachProfilePage] User ${user.id} is not a coach.`);
            toast({ title: "Not a Coach", description: "This dashboard is for coaches.", variant: "destructive" });
            setCurrentCoach(null); // Clear coach data
          }
        } else {
          // This case handles when the user is marked as 'coach' in auth but has no Firestore document.
          // It adapts the logic from the original `else if (!coachData && user.role === 'coach')`
          if (user.role === 'coach') { // Check against auth context role
            console.warn(`[CoachProfilePage] No existing Firestore profile for coach ${user.id}. Pre-filling from auth context.`);
            reset({
              name: user.name || '',
              email: user.email || '',
              availability: [],
              selectedSpecialties: [],
              // Clear other fields that would have come from Firestore
              bio: '',
              profileImageUrl: '',
              location: '',
              websiteUrl: '',
              introVideoUrl: '',
              socialLinkPlatform: '',
              socialLinkUrl: '',
              keywords: '',
              certifications: '',
            });
            setCurrentCoach(null); // No Firestore profile
            setImagePreviewUrl(null);
            setAvailableSpecialties(allSpecialtiesList); // Reset to default specialties
            // Potentially show a message or guide the user to complete their profile.
            // toast({ title: "Profile Incomplete", description: "Please complete your coach profile.", variant: "default" });
          } else {
             // If user.role is not 'coach' and doc doesn't exist, it's not a coach scenario.
            console.warn(`[CoachProfilePage] User ${user.id} has no Firestore profile and is not marked as coach in auth.`);
            setCurrentCoach(null);
          }
        }
        setIsSubmitting(false);
      },
      (error) => {
        console.error("Error listening to user profile:", error);
        toast({ title: "Error Loading Profile", description: "Could not load profile data in real-time.", variant: "destructive" });
        setIsSubmitting(false);
      }
    );

    return () => {
      unsub();
    };
  }, [user, authLoading, reset, setValue, toast]);

  const handleImageFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setValue('profileImageUrl', '');
    } else {
      setSelectedFile(null);
    }
  };

  const handleRemoveImage = async () => {
    if (!user || !currentCoach || !currentCoach.profileImageUrl) return;
    setIsSubmitting(true); 
    setIsUploadingImage(true);
    try {
      if (currentCoach.profileImageUrl.includes('firebasestorage.googleapis.com')) {
        await uploadProfileImage(undefined as any, user.id, currentCoach.profileImageUrl);
      } 
      await setUserProfile(user.id, { profileImageUrl: null });
      setValue('profileImageUrl', '');
      setSelectedFile(null);
      setImagePreviewUrl(null);
      setCurrentCoach(prev => prev ? { ...prev, profileImageUrl: null } : null);
      toast({ title: "Image Removed", description: "Your profile image has been removed." });
    } catch (error: any) {
      console.error("Error removing image:", error);
      toast({ title: "Error Removing Image", description: error.message || "Could not remove image.", variant: "destructive"});
    }
    setIsUploadingImage(false);
    setIsSubmitting(false);
  };

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
        } finally {
          setIsAiLoading(false);
        }
      }
    }, 1000),
    []
  );

  useEffect(() => {
    if (bioValue) {
      fetchSuggestions(bioValue);
    }
  }, [bioValue, fetchSuggestions]);

  const isPremium = currentCoach?.subscriptionTier === 'premium';

  const onSubmit: SubmitHandler<CoachProfileFormData> = async (data) => {
    if (!user || !currentCoach) {
        toast({ title: "Error", description: "User not authenticated or coach data missing.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    let finalImageUrl = data.profileImageUrl; 

    if (selectedFile && isPremium) {
      setIsUploadingImage(true);
      try {
        toast({ title: "Uploading Image...", description: "Please wait while your new profile image is uploaded." });
        const newImageUrl = await uploadProfileImage(selectedFile, user.id, currentCoach.profileImageUrl || null);
        finalImageUrl = newImageUrl;
        setValue('profileImageUrl', newImageUrl);
        setImagePreviewUrl(newImageUrl);
        setSelectedFile(null);
      } catch (error: any) {
        console.error('Error uploading image during submit:', error);
        toast({ title: "Image Upload Failed", description: error.message || "Could not upload new image. Profile saved without image update.", variant: "destructive" });
      } finally {
        setIsUploadingImage(false);
      }
    } 

    const keywordsArray = (data.keywords?.split(',').map(k => k.trim()).filter(Boolean)) || [];
    const certificationsArray = (data.certifications?.split(',').map(c => c.trim()).filter(Boolean)) || [];

    const profileToSave: Partial<Omit<FirestoreUserProfile, 'id' | 'email' | 'role' | 'createdAt' | 'subscriptionTier' | 'status'>> = { 
        name: data.name,
        bio: data.bio,
        specialties: data.selectedSpecialties,
        keywords: keywordsArray,
        profileImageUrl: isPremium ? (finalImageUrl || null) : null, 
        certifications: certificationsArray,
        location: data.location || null,
        websiteUrl: data.websiteUrl || null,
        introVideoUrl: data.introVideoUrl || null,
        socialLinks: data.socialLinkPlatform && data.socialLinkUrl ? [{ platform: data.socialLinkPlatform, url: data.socialLinkUrl }] : [],
        availability: data.availability || [], 
    };

    try {
        await setUserProfile(user.id, profileToSave);
        setCurrentCoach(prev => prev ? { ...prev, ...profileToSave, profileImageUrl: finalImageUrl } : null); 
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

  const handleAddAvailabilitySlot = () => {
    if (newSlotDay.trim() && newSlotTime.trim()) {
      appendAvailability({ day: newSlotDay.trim(), time: newSlotTime.trim() });
      setNewSlotDay(''); 
      setNewSlotTime(''); 
    } else {
      toast({
        title: "Missing Information",
        description: "Please enter both day and time for the availability slot.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveAvailabilitySlot = (index: number) => {
    removeAvailability(index);
  };

  if (authLoading || (!user && !currentCoach && !isSubmitting)) {
    return <div className="flex justify-center items-center h-full min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /> Loading profile...</div>;
  }

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
              {isPremium ? (
                <div className="space-y-2">
                  <Label htmlFor="profileImageFile">Profile Image</Label>
                  <div className="flex items-center gap-4">
                    {imagePreviewUrl ? (
                      <div className="relative w-32 h-32">
                        <NextImage src={imagePreviewUrl} alt="Profile preview" fill sizes="128px" className="rounded-md object-cover border" />
                      </div>
                    ) : (
                      <div className="w-32 h-32 bg-muted rounded-md flex items-center justify-center">
                        <ImageIcon className="w-16 h-16 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 space-y-2">
                      <Input 
                        id="profileImageFile" 
                        type="file" 
                        accept="image/png, image/jpeg, image/webp" 
                        onChange={handleImageFileChange} 
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        disabled={isUploadingImage || isSubmitting}
                      />
                      <p className="text-xs text-muted-foreground">Upload a PNG, JPG, or WEBP file (max 2MB recommended).</p>
                      {profileImageUrlValue && !selectedFile && (
                         <Button variant="outline" size="sm" onClick={handleRemoveImage} disabled={isUploadingImage || isSubmitting} className="text-destructive hover:text-destructive/90 border-destructive/50 hover:border-destructive/70">
                           <Trash2 className="mr-2 h-4 w-4"/> Remove Current Image
                         </Button>
                      )}
                      {selectedFile && (
                        <Button variant="outline" size="sm" onClick={() => { setSelectedFile(null); setImagePreviewUrl(profileImageUrlValue || null); (document.getElementById('profileImageFile') as HTMLInputElement).value = ''}} disabled={isUploadingImage || isSubmitting}>
                           Cancel Selection
                         </Button>
                      )}
                    </div>
                  </div>
                  {isUploadingImage && <p className="text-sm text-primary flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Uploading image...</p>}
                  <input type="hidden" {...register('profileImageUrl')} /> 
                  {errors.profileImageUrl && <p className="text-sm text-destructive">{errors.profileImageUrl.message}</p>}
                </div>
              ) : (
                <div className="space-y-2 p-4 bg-muted/50 rounded-md">
                  <Label className="text-muted-foreground">Profile Image</Label>
                  <p className="text-sm text-muted-foreground">
                    Add a professional profile picture to enhance your listing. This feature is available for Premium coaches. 
                    <Link href="/pricing" className="text-primary hover:underline ml-1">Upgrade to Premium</Link>.
                  </p>
                </div>
              )}
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
                        <Link href="/pricing"><span><Crown className="mr-2 h-4 w-4 text-yellow-500" /> Upgrade to Premium</span></Link>
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
          
          <section>
             <h3 className="text-lg font-semibold mb-4 border-b pb-2 flex items-center">
               <CalendarDays className="mr-2 h-5 w-5 text-primary"/>Availability Slots
             </h3>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Specify the days and time frames you are generally available. E.g., Day: Monday, Time: 10am - 1pm.
              </p>
              
              <div className="space-y-3">
                {availabilityFields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-3 p-3 border rounded-md bg-muted/30 shadow-sm">
                    <Input
                      {...register(`availability.${index}.day`)}
                      placeholder="Day (e.g., Monday)"
                      className="flex-1 py-2.5 bg-background"
                      defaultValue={field.day} 
                    />
                    <Input
                      {...register(`availability.${index}.time`)}
                      placeholder="Time (e.g., 9am - 5pm)"
                      className="flex-1 py-2.5 bg-background"
                      defaultValue={field.time} 
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      onClick={() => removeAvailability(index)} 
                      size="icon" 
                      className="text-destructive hover:text-destructive/80 shrink-0"
                      aria-label="Remove slot"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-end gap-3 pt-4 border-t mt-4">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="newSlotDayInput" className="text-sm font-medium">New Day</Label>
                  <Input 
                    id="newSlotDayInput" 
                    placeholder="e.g., Wednesday" 
                    value={newSlotDay} 
                    onChange={(e) => setNewSlotDay(e.target.value)} 
                    className="py-2.5"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="newSlotTimeInput" className="text-sm font-medium">New Time Frame</Label>
                  <Input 
                    id="newSlotTimeInput" 
                    placeholder="e.g., 2pm - 5pm" 
                    value={newSlotTime} 
                    onChange={(e) => setNewSlotTime(e.target.value)} 
                    className="py-2.5"
                  />
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handleAddAvailabilitySlot} 
                  className="shrink-0"
                  disabled={!newSlotDay.trim() || !newSlotTime.trim()}
                >
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Slot
                </Button>
              </div>

              {errors.availability && !Array.isArray(errors.availability) && errors.availability.root && (
                 <p className="text-sm text-destructive mt-1">{errors.availability.root.message}</p>
              )}
               {Array.isArray(errors.availability) && errors.availability.map((err, i) => (
                (err?.day || err?.time) && (
                  <div key={i} className="text-sm text-destructive mt-1">
                    {err.day && <p>Slot {i+1} Day: {err.day.message}</p>}
                    {err.time && <p>Slot {i+1} Time: {err.time.message}</p>}
                  </div>
                )
              ))}
              {errors.availability && typeof errors.availability.message === 'string' && (
                 <p className="text-sm text-destructive mt-1">{errors.availability.message}</p>
              )}
            </div>
          </section>

          <Button type="submit" disabled={isSubmitting || isAiLoading || authLoading || isUploadingImage} size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            {isSubmitting || authLoading || isUploadingImage ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                {isUploadingImage ? 'Uploading Image...' : (isSubmitting ? 'Saving Changes...' : 'Loading...')}
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