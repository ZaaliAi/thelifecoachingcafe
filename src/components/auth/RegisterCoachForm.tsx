'use client';

import { useState, useEffect, useCallback, type ChangeEvent, useRef } from 'react';
import { useForm, Controller, type SubmitHandler, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserPlus, Lightbulb, X, Crown, CalendarDays, Sparkles, PlusCircle, Image as ImageIcon, UploadCloud, Trash2, KeyRound, LinkIcon, Award, MapPin, Video, Star } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { suggestCoachSpecialties, type SuggestCoachSpecialtiesOutput } from '@/ai/flows/suggest-coach-specialties';
import { debounce } from 'lodash';
import NextImage from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { uploadProfileImage } from '@/services/imageUpload';
import type { FirestoreUserProfile } from '@/types';
import { Badge } from '@/components/ui/badge';
import getStripe from '@/lib/stripe';
import { getFunctions, httpsCallable, Functions } from 'firebase/functions';
import { firebaseApp } from '@/lib/firebase';

interface RegisterCoachFormProps {
  planId?: string | null;
}

const availabilitySlotSchema = z.object({
  day: z.string().min(1, 'Day is required.').max(50, 'Day seems too long.'),
  time: z.string().min(1, 'Time is required.').max(50, 'Time seems too long.'),
});

const coachRegistrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
  bio: z.string().min(50, 'Bio must be at least 50 characters for AI suggestions.').optional().or(z.literal('')),
  selectedSpecialties: z.array(z.string()).min(1, 'Please select or add at least one specialty.'),
  keywords: z.string().optional(),
  certifications: z.string().optional(),
  location: z.string().optional(),
  profileImageUrl: z.string().url('Profile image URL must be a valid URL.').optional().or(z.literal('')).nullable(),
  websiteUrl: z.string().url('Invalid URL for website.').optional().or(z.literal('')),
  introVideoUrl: z.string().url('Invalid URL for intro video.').optional().or(z.literal('')),
  socialLinkPlatform: z.string().optional(),
  socialLinkUrl: z.string().url('Invalid URL for social link.').optional().or(z.literal('')),
  availability: z.array(availabilitySlotSchema).min(1, "Please add at least one availability slot.").optional().default([]),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type CoachRegistrationFormData = z.infer<typeof coachRegistrationSchema>;

export default function RegisterCoachForm({ planId }: RegisterCoachFormProps) {
  const router = useRouter();
  const { registerWithEmailAndPassword, loading: authLoading } = useAuth();
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestCoachSpecialtiesOutput | null>(null);
  const [customSpecialtyInput, setCustomSpecialtyInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newSlotDay, setNewSlotDay] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('');

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CoachRegistrationFormData>({
    resolver: zodResolver(coachRegistrationSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      bio: '',
      selectedSpecialties: [],
      keywords: '',
      certifications: '',
      location: '',
      profileImageUrl: null,
      websiteUrl: '',
      introVideoUrl: '',
      socialLinkPlatform: '',
      socialLinkUrl: '',
      availability: [],
    },
  });

  const { fields: availabilityFields, append: appendAvailability, remove: removeAvailability } = useFieldArray({
    control,
    name: "availability",
  });

  const bioValue = watch('bio');
  const currentSelectedSpecialties = watch('selectedSpecialties') || [];

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setValue('profileImageUrl', '', { shouldValidate: false });
    }
  };

  const handleRemoveImage = () => {
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setValue('profileImageUrl', '', { shouldValidate: false });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const debouncedFetchSuggestions = useCallback(
    debounce(async (bioText: string) => {
      if (bioText.length >= 50) {
        setIsAiLoading(true);
        setAiSuggestions(null);
        try {
          const suggestions = await suggestCoachSpecialties({ bio: bioText });
          setAiSuggestions(suggestions);
        } catch (error) {
          console.error('Error fetching AI suggestions:', error);
        }
        setIsAiLoading(false);
      }
    }, 1000),
    [setIsAiLoading, setAiSuggestions]
  );

  useEffect(() => {
    if (bioValue && bioValue.length >= 50) {
      debouncedFetchSuggestions(bioValue);
    } else {
      setAiSuggestions(null);
    }
  }, [bioValue, debouncedFetchSuggestions]);

  const onSubmit: SubmitHandler<CoachRegistrationFormData> = async (data) => {
    let finalProfileImageUrl: string | null = data.profileImageUrl || null;
    let createdUserId: string | null = null;

    try {
      const { password, confirmPassword, ...profileDetails } = data;
      let additionalDataForAuth: Partial<FirestoreUserProfile> = {
        ...profileDetails,
        planId: planId || undefined,
        photoURL: null,
        specialties: data.selectedSpecialties,
        availability: data.availability,
      };

      if (selectedFile) {
        toast({ title: 'Uploading profile image...', description: 'Please wait.' });
      }
      
      const registeredUser = await registerWithEmailAndPassword(
        data.email,
        data.password,
        data.name,
        'coach',
        additionalDataForAuth
      );

      if (!registeredUser || !registeredUser.uid) {
        throw new Error("User registration failed, UID not returned.");
      }
      createdUserId = registeredUser.uid;

      if (selectedFile && createdUserId) {
        finalProfileImageUrl = await uploadProfileImage(selectedFile, createdUserId, null);
        console.log("Profile image URL after upload (to be updated in Firestore):", finalProfileImageUrl);
      }
      
      toast({
        title: 'Registration Successful!',
        description: 'Your coach account has been created.',
        variant: 'success',
      });

      if (planId && createdUserId) {
        toast({ title: "Redirecting to subscription...", description: "Please wait." });
        const functionsInstance: Functions = getFunctions(firebaseApp);
        const createCheckoutSession = httpsCallable(functionsInstance, 'createCheckoutSessionCallable');
        
        const successUrl = `${window.location.origin}/dashboard/coach/profile?subscription_success=true`;
        const cancelUrl = `${window.location.origin}/pricing?subscription_cancelled=true`;

        const { data: checkoutData }: any = await createCheckoutSession({
          priceId: planId,
          successUrl: successUrl,
          cancelUrl: cancelUrl,
          userId: createdUserId,
        });

        if (checkoutData.error) {
          throw new Error(checkoutData.error.message || "Could not create Stripe session after registration.");
        }

        if (checkoutData.sessionId) {
          const stripe = await getStripe();
          if (stripe) {
            const { error: stripeError } = await stripe.redirectToCheckout({ sessionId: checkoutData.sessionId });
            if (stripeError) {
              throw new Error(stripeError.message || "Error redirecting to Stripe.");
            }
            return;
          }
          throw new Error("Stripe.js failed to load.");
        }
        throw new Error("No sessionId returned from createCheckoutSessionCallable.");
      }
      router.push('/dashboard/coach/profile');
    } catch (error: any) {
      console.error('Error during coach registration process:', error);
      toast({
        title: 'Registration Failed',
        description: error.message || 'There was an error submitting your profile. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  const addSuggestedKeyword = (keyword: string) => {
    const currentKeywords = getValues('keywords') || '';
    const keywordsArray = currentKeywords.split(',').map(k => k.trim()).filter(k => k);
    if (!keywordsArray.includes(keyword)) {
      setValue('keywords', [...keywordsArray, keyword].join(', '), { shouldValidate: true });
    }
  };

  const addSpecialty = (specialty: string) => {
    if (specialty.trim() === '') return;
    const currentSpecialties = getValues('selectedSpecialties') || [];
    if (!currentSpecialties.includes(specialty.trim())) {
      setValue('selectedSpecialties', [...currentSpecialties, specialty.trim()], { shouldValidate: true });
    }
  };

  const handleAddCustomSpecialty = () => {
    if (customSpecialtyInput.trim() !== '') {
      addSpecialty(customSpecialtyInput.trim());
      setCustomSpecialtyInput('');
    }
  };

  const removeSpecialty = (specialtyToRemove: string) => {
    const currentSpecialties = getValues('selectedSpecialties') || [];
    setValue('selectedSpecialties', currentSpecialties.filter(s => s !== specialtyToRemove), { shouldValidate: true });
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

 return (
    <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-3xl bg-background">
      <section className="mb-12 text-center py-8 px-6 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 shadow-lg border border-border/20">
        <div className="flex items-center justify-center mb-4">
          <UserPlus className="h-12 w-12 text-primary mr-4" />
          <h1 className="text-4xl font-extrabold tracking-tight text-primary sm:text-5xl">Register as a Coach</h1>
        </div>
        <p className="mt-4 text-lg leading-6 text-muted-foreground max-w-xl mx-auto">
          Ready to inspire and guide others? Fill out your profile below to join our community of talented coaches.
          {planId && <span className="block mt-2 font-semibold">You're signing up as a Premium User</span>}
        </p>
      </section>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card className="shadow-xl border-border/20 overflow-hidden">
          <CardHeader className="p-6 bg-muted/30 border-b border-border/20 rounded-t-lg">
            <CardTitle className="flex items-center text-2xl font-semibold text-primary">
              <UserPlus className="mr-3 h-7 w-7" /> Personal Information
            </CardTitle>
            <CardDescription className="mt-1">Let's start with the basics to create your account.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 grid gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-base font-medium">Full Name</Label>
              <Controller name="name" control={control} render={({ field }) => <Input id="name" placeholder="e.g., Jane Doe" {...field} className="text-base py-2.5" />} />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base font-medium">Email Address</Label>
              <Controller name="email" control={control} render={({ field }) => <Input id="email" type="email" placeholder="you@example.com" {...field} className="text-base py-2.5" />} />
              {errors.email && <p className="text-sm text-destructive mt-1">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-base font-medium">Password</Label>
              <Controller name="password" control={control} render={({ field }) => <Input id="password" type="password" placeholder="••••••••" {...field} className="text-base py-2.5" />} />
              {errors.password && <p className="text-sm text-destructive mt-1">{errors.password.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-base font-medium">Confirm Password</Label>
              <Controller name="confirmPassword" control={control} render={({ field }) => <Input id="confirmPassword" type="password" placeholder="••••••••" {...field} className="text-base py-2.5" />} />
              {errors.confirmPassword && <p className="text-sm text-destructive mt-1">{errors.confirmPassword.message}</p>}
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-xl border-border/20 overflow-hidden">
          <CardHeader className="p-6 bg-muted/30 border-b border-border/20 rounded-t-lg">
            <CardTitle className="flex items-center text-2xl font-semibold text-primary">
              <Lightbulb className="mr-3 h-7 w-7" /> Coaching Profile
            </CardTitle>
            <CardDescription className="mt-1">Showcase your expertise and unique approach.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 grid gap-6">
            <div className="space-y-2">
              <Label htmlFor="bio" className="text-base font-medium">Your Bio</Label>
              <Controller name="bio" control={control} render={({ field }) => (
                  <Textarea id="bio" placeholder="Share your coaching philosophy... (Min 50 characters for AI suggestions)" {...field} rows={6} className="text-base py-2.5" />
              )} />
              {errors.bio && <p className="text-sm text-destructive mt-1">{errors.bio.message}</p>}
              {isAiLoading && <div className="flex items-center text-sm text-muted-foreground mt-3"><Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />Analyzing bio...</div>}
              {aiSuggestions && (
                <div className="mt-4 p-4 border border-dashed border-primary/50 rounded-lg bg-primary/5">
                  <div className="flex items-center mb-3"><Sparkles className="h-6 w-6 text-primary mr-2" /><h4 className="text-lg font-semibold text-primary">Smart Suggestions ✨</h4></div>
                  {aiSuggestions.keywords && aiSuggestions.keywords.length > 0 && (
                    <div className="mb-4">
                      <Label className="text-base font-medium text-foreground">Keywords:</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {aiSuggestions.keywords.map(k => <Button key={k} type="button" variant="outline" size="sm" onClick={() => addSuggestedKeyword(k)} className="bg-background hover:bg-muted"><PlusCircle className="mr-2 h-4 w-4"/>{k}</Button>)} 
                      </div>
                    </div>
                  )}
                  {aiSuggestions.specialties && aiSuggestions.specialties.length > 0 && (
                    <div>
                      <Label className="text-base font-medium text-foreground">Specialties:</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {aiSuggestions.specialties.map(s => <Button key={s} type="button" variant="outline" size="sm" onClick={() => addSpecialty(s)} className="bg-background hover:bg-muted"><PlusCircle className="mr-2 h-4 w-4"/>{s}</Button>)} 
                      </div>
                    </div>
                  )}
                  {(aiSuggestions.keywords?.length === 0 && aiSuggestions.specialties?.length === 0) && <p className="text-sm text-muted-foreground">No suggestions. Expand bio.</p>}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customSpecialtyInput" className="text-base font-medium">Your Specialties</Label>
              <p className="text-sm text-muted-foreground mb-3">Add from AI suggestions or type your own. (Min. 1 required)</p>
              <div className="flex flex-wrap gap-2 mb-3 min-h-[2.5rem] p-2 border rounded-md bg-muted/20 items-center">
                {currentSelectedSpecialties.length > 0 ? currentSelectedSpecialties.map(s => <Badge key={s} variant="secondary" className="text-sm py-1 px-2.5 flex items-center gap-1.5">{s}<button type="button" onClick={() => removeSpecialty(s)} className="rounded-full hover:bg-destructive/20 p-0.5 text-destructive-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button></Badge>) : <span className="text-sm text-muted-foreground px-1">No specialties yet.</span>} 
              </div>
              <div className="flex gap-3 items-center">
                <Input id="customSpecialtyInput" placeholder="Type specialty & click Add" value={customSpecialtyInput} onChange={e => setCustomSpecialtyInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && customSpecialtyInput.trim() !== '') { e.preventDefault(); handleAddCustomSpecialty();}}} className="text-base py-2.5" /> 
                <Button type="button" variant="outline" onClick={handleAddCustomSpecialty} disabled={customSpecialtyInput.trim() === ''} className="shrink-0"><PlusCircle className="mr-2 h-4 w-4" /> Add</Button> 
              </div>
              {errors.selectedSpecialties && <p className="text-sm text-destructive mt-1">{errors.selectedSpecialties.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords" className="text-base font-medium">Keywords</Label>
              <Controller name="keywords" control={control} render={({ field }) => <Input id="keywords" placeholder="e.g., career change, leadership (comma-separated)" {...field} className="text-base py-2.5" />} />
              {errors.keywords && <p className="text-sm text-destructive mt-1">{errors.keywords.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="certifications" className="text-base font-medium flex items-center"><Award className="mr-2 h-5 w-5 text-primary/80" />Certifications</Label>
              <Controller name="certifications" control={control} render={({ field }) => <Input id="certifications" placeholder="e.g., ICF Certified Coach, NBC-HWC" {...field} className="text-base py-2.5" />} />
              {errors.certifications && <p className="text-sm text-destructive mt-1">{errors.certifications.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-base font-medium flex items-center"><MapPin className="mr-2 h-5 w-5 text-primary/80" />Location</Label>
              <Controller name="location" control={control} render={({ field }) => <Input id="location" placeholder="e.g., New York, USA or Remote" {...field} className="text-base py-2.5" />} />
              {errors.location && <p className="text-sm text-destructive mt-1">{errors.location.message}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-border/20 overflow-hidden">
          <CardHeader className="p-6 bg-muted/30 border-b border-border/20 rounded-t-lg">
            <CardTitle className="flex items-center text-2xl font-semibold text-primary">
              <Crown className="mr-3 h-7 w-7" /> Premium Profile Boosters
            </CardTitle>
            <CardDescription className="mt-1">Enhance your profile with these additional details.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 grid gap-6">
            <div className="space-y-2">
                <div className="flex items-center">
                    <Label htmlFor="profileImageUpload" className="text-base font-medium">Profile Picture</Label>
                    <Badge variant="premium" className="ml-2"><Star className="mr-1 h-3 w-3" />Premium</Badge>
                </div>
                <div className="mt-1 flex flex-col items-center space-y-4">
                    {imagePreviewUrl ? (
                    <div className="relative w-40 h-40 rounded-full overflow-hidden shadow-md">
                        <NextImage src={imagePreviewUrl} alt="Profile Preview" layout="fill" objectFit="cover" />
                    </div>
                    ) : (
                    <div className="w-40 h-40 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-16 h-16" />
                    </div>
                    )}
                    <div className="flex space-x-3">
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <UploadCloud className="mr-2 h-4 w-4" /> {selectedFile ? 'Change Image' : 'Upload Image'}
                    </Button>
                    <input 
                        type="file" 
                        id="profileImageUpload" 
                        className="hidden" 
                        accept="image/png, image/jpeg, image/jpg" 
                        onChange={handleImageChange} 
                        ref={fileInputRef}
                    />
                    {imagePreviewUrl && (
                        <Button type="button" variant="ghost" size="icon" onClick={handleRemoveImage} aria-label="Remove image"> 
                        <Trash2 className="h-5 w-5 text-destructive" />
                        </Button>
                    )}
                    </div>
                </div>
                {errors.profileImageUrl && <p className="text-sm text-destructive mt-1">{errors.profileImageUrl.message}</p>}
                <p className="text-xs text-muted-foreground text-center mt-2">
                    <span>A professional profile picture significantly increases your visibility. Recommended: Square (1:1), JPG/PNG. Max 2MB.</span>
                    {!planId && (
                        <span className="ml-1"> This is a premium feature. <Link href="/pricing" className="underline text-primary hover:text-primary/80">Upgrade to Premium</Link> to enable.</span>
                    )}
                </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrl" className="text-base font-medium flex items-center"><LinkIcon className="mr-2 h-5 w-5 text-primary/80" />Website URL</Label>
              <Controller name="websiteUrl" control={control} render={({ field }) => <Input id="websiteUrl" type="url" placeholder="https://yourwebsite.com" {...field} className="text-base py-2.5" />} />
              {errors.websiteUrl && <p className="text-sm text-destructive mt-1">{errors.websiteUrl.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="introVideoUrl" className="text-base font-medium flex items-center"><Video className="mr-2 h-5 w-5 text-primary/80" />Intro Video URL (e.g., YouTube, Vimeo)</Label>
              <Controller name="introVideoUrl" control={control} render={({ field }) => <Input id="introVideoUrl" type="url" placeholder="https://youtube.com/yourvideo" {...field} className="text-base py-2.5" />} />
              {errors.introVideoUrl && <p className="text-sm text-destructive mt-1">{errors.introVideoUrl.message}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="socialLinkPlatform" className="text-base font-medium">Social Media Platform</Label>
                <Controller name="socialLinkPlatform" control={control} render={({ field }) => <Input id="socialLinkPlatform" placeholder="e.g., LinkedIn, Twitter" {...field} className="text-base py-2.5" />} />
                {errors.socialLinkPlatform && <p className="text-sm text-destructive mt-1">{errors.socialLinkPlatform.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="socialLinkUrl" className="text-base font-medium">Social Media URL</Label>
                <Controller name="socialLinkUrl" control={control} render={({ field }) => <Input id="socialLinkUrl" type="url" placeholder="https://linkedin.com/in/yourprofile" {...field} className="text-base py-2.5" />} />
                {errors.socialLinkUrl && <p className="text-sm text-destructive mt-1">{errors.socialLinkUrl.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-border/20 overflow-hidden">
          <CardHeader className="p-6 bg-muted/30 border-b border-border/20 rounded-t-lg">
            <CardTitle className="flex items-center text-2xl font-semibold text-primary">
              <CalendarDays className="mr-3 h-7 w-7" /> Your Availability
            </CardTitle>
            <CardDescription className="mt-1">{'Let clients know when you're available. You can update your availability anytime in Coach dashboard'}</CardDescription>
          </CardHeader>
          <CardContent className="p-6 grid gap-6">
            <div className="space-y-4">
              {availabilityFields.map((field, index) => (
                <div key={field.id} className="flex items-end gap-3 p-3 border rounded-md bg-muted/20">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`availability.${index}.day`} className="text-sm font-medium">Day</Label>
                    <Controller
                      name={`availability.${index}.day` as const}
                      control={control}
                      render={({ field }) => <Input placeholder="e.g., Monday" {...field} className="text-base" />}
                    />
                    {errors.availability?.[index]?.day && 
                      <p className="text-sm text-destructive">{errors.availability[index]?.day?.message}</p>}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`availability.${index}.time`} className="text-sm font-medium">Time Slot</Label>
                    <Controller
                      name={`availability.${index}.time` as const}
                      control={control}
                      render={({ field }) => <Input placeholder="e.g., 9am - 5pm" {...field} className="text-base" />}
                    />
                    {errors.availability?.[index]?.time && 
                      <p className="text-sm text-destructive">{errors.availability[index]?.time?.message}</p>}
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeAvailability(index)} className="text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-end gap-3 mt-4 pt-4 border-t border-border/20">
                <div className="flex-1 space-y-1.5">
                    <Label htmlFor="newSlotDay" className="text-sm font-medium">New Day</Label>
                    <Input id="newSlotDay" placeholder="e.g., Wednesday" value={newSlotDay} onChange={(e) => setNewSlotDay(e.target.value)} className="text-base"/>
                </div>
                <div className="flex-1 space-y-1.5">
                    <Label htmlFor="newSlotTime" className="text-sm font-medium">New Time Slot</Label>
                    <Input id="newSlotTime" placeholder="e.g., 10am - 2pm" value={newSlotTime} onChange={(e) => setNewSlotTime(e.target.value)} className="text-base"/>
                </div>
              <Button type="button" variant="outline" onClick={handleAddAvailabilitySlot} className="whitespace-nowrap shrink-0">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Slot
              </Button>
            </div>
            {errors.availability && typeof errors.availability === 'object' && 'message' in errors.availability && (
                <p className="text-sm text-destructive mt-2">{errors.availability.message}</p>
            )}
          </CardContent>
        </Card>

        <Button type="submit" className="w-full py-3 text-lg font-semibold tracking-wide shadow-lg hover:shadow-xl transition-shadow duration-200 ease-in-out" disabled={isSubmitting || authLoading || isAiLoading} size="lg">
          {isSubmitting || authLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
          {isSubmitting || authLoading ? 'Processing Registration...' : 'Create Account & Proceed to Payment'}
        </Button>
      </form>
    </div>
  );
}
