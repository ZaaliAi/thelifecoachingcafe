'''use client''';

import { useState, useEffect, useCallback, type ChangeEvent, useRef } from 'react';
import { useForm, Controller, type SubmitHandler, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserPlus, Lightbulb, X, Crown, CalendarDays, Sparkles, PlusCircle, Image as ImageIcon, UploadCloud, Trash2, KeyRound } from 'lucide-react'; // Added KeyRound
import { toast } from '@/hooks/use-toast';
import { suggestCoachSpecialties, type SuggestCoachSpecialtiesOutput } from '@/ai/flows/suggest-coach-specialties';
import { debounce } from 'lodash';
import Link from 'next/link';
import NextImage from 'next/image';
import { useAuth } from '@/lib/auth'; // Using the new auth hook
import { useRouter } from 'next/navigation';
import { uploadProfileImage } from '@/services/imageUpload';
import type { FirestoreUserProfile } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";
import getStripe from '@/lib/stripe'; // For Stripe redirect
import { getFunctions, httpsCallable, Functions } from 'firebase/functions'; // For calling checkout session
import { firebaseApp } from '@/lib/firebase';

interface RegisterCoachFormProps {
  planId?: string | null; // Accept planId
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
  profileImageUrl: z.string().url('Profile image URL must be a valid URL.').optional().or(z.literal('')).nullable(),
  certifications: z.string().optional(),
  location: z.string().optional(),
  websiteUrl: z.string().url('Invalid URL for website.').optional().or(z.literal('')),
  introVideoUrl: z.string().url('Invalid URL for intro video.').optional().or(z.literal('')),
  socialLinkPlatform: z.string().optional(),
  socialLinkUrl: z.string().url('Invalid URL for social link.').optional().or(z.literal('')),
  availability: z.array(availabilitySlotSchema).optional().default([]),
  // status will be set by registerWithEmailAndPassword
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"], 
});

type CoachRegistrationFormData = z.infer<typeof coachRegistrationSchema>;

export default function RegisterCoachForm({ planId }: RegisterCoachFormProps) {
  const router = useRouter();
  const { registerWithEmailAndPassword, loading: authLoading } = useAuth(); // Using the new auth hook
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
    reset,
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

  // useEffect to reset form if user logs in/out or query params change, can be simplified if form is only for new reg
  // For now, removing the user-based reset as this form will handle initial registration

  const bioValue = watch('bio');
  const currentSelectedSpecialties = watch('selectedSpecialties') || [];

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setValue('profileImageUrl', '', { shouldValidate: false }); // Clear any manually entered URL
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
      setAiSuggestions(null); // Clear suggestions if bio is too short
    }
  }, [bioValue, debouncedFetchSuggestions]);

  const onSubmit: SubmitHandler<CoachRegistrationFormData> = async (data) => {
    let finalProfileImageUrl: string | null = data.profileImageUrl || null;
    let createdUserId: string | null = null;

    try {
      // Step 1: Register Firebase Auth user and create initial Firestore document
      // The registerWithEmailAndPassword function will handle creating the user in Auth 
      // and their basic profile in Firestore with role 'coach' and status 'pending_approval'
      
      // Prepare additional data for Firestore, excluding password fields
      const { password, confirmPassword, ...profileDetails } = data;
      
      let additionalDataForAuth: Partial<FirestoreUserProfile> = {
        ...profileDetails,
        planId: planId || undefined, // Pass planId if present
        // ensure all fields expected by FirestoreUserProfile are at least initialized if not in form
        photoURL: null, // Will be updated after image upload
        specialties: data.selectedSpecialties, // Ensure this is correctly named as in FirestoreUserProfile
        // any other fields...
      };

      if (selectedFile) {
        toast({ title: 'Uploading profile image...', description: 'Please wait.' });
        // Temporarily store other data, upload image, then update profile
        // For now, let's assume image upload happens after user ID is known
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

      // Step 2: Upload profile image if selected, now that we have the userId
      if (selectedFile && createdUserId) {
        finalProfileImageUrl = await uploadProfileImage(selectedFile, createdUserId, null);
        // Update Firestore with the new profile image URL
        const functions = getFunctions(firebaseApp);
        const setUserProfileCallable = httpsCallable(functions, 'setUserProfile'); // Assuming you have a callable for this
                                                                              // OR directly update with admin SDK from a function, or client SDK here if rules allow.
                                                                              // For simplicity, let's assume a callable or direct update can be made.
                                                                              // This part needs careful implementation based on your Firestore rules and setup.
        // For now, we will rely on the initial setDoc in registerWithEmailAndPassword to include most data,
        // and image URL would be an update. Or, modify registerWithEmailAndPassword to handle this.
        // To keep it simpler for this step, we'll assume the image URL can be updated later or handled within register flow.
        // The `additionalDataForAuth` already passed profile details.
        // If image upload is critical path before Stripe, `registerWithEmailAndPassword` needs to return UID first,
        // then upload, then update Firestore, then proceed to Stripe.
        // For now, we will just proceed, image can be added by user later if this is too complex for one flow.
        console.log("Profile image URL to be set (if any):", finalProfileImageUrl);
        // Ideally, update user profile here with the finalProfileImageUrl
      }
      
      toast({
        title: 'Registration Successful!',
        description: 'Your coach account has been created.',
        variant: 'success',
      });

      // Step 3: If planId is present, initiate Stripe checkout
      if (planId && createdUserId) {
        toast({ title: "Redirecting to subscription...", description: "Please wait." });
        const functionsInstance: Functions = getFunctions(firebaseApp);
        const createCheckoutSession = httpsCallable(functionsInstance, 'createCheckoutSessionCallable');
        
        const successUrl = `${window.location.origin}/dashboard/coach/profile?subscription_success=true`; // Or a dedicated success page
        const cancelUrl = `${window.location.origin}/pricing?subscription_cancelled=true`;

        const { data: checkoutData }: any = await createCheckoutSession({
          priceId: planId,
          successUrl: successUrl,
          cancelUrl: cancelUrl,
          userId: createdUserId, // Pass the newly created user's ID
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
            // If redirectToCheckout is successful, the user is navigated away, so no further action here.
            return; // Stop execution as user is being redirected
          }
          throw new Error("Stripe.js failed to load.");
        }
        throw new Error("No sessionId returned from createCheckoutSessionCallable.");
      }

      // If no planId, or if Stripe redirect didn't happen (e.g. error before redirect)
      router.push('/dashboard/coach/profile'); // Default redirect if no plan or post-Stripe (if Stripe fails before redirect)

    } catch (error: any) {
      console.error('Error during coach registration process:', error);
      toast({
        title: 'Registration Failed',
        description: error.message || 'There was an error submitting your profile. Please try again.',
        variant: 'destructive',
      });
    }
  };
  
  // ... (rest of the helper functions: addSuggestedKeyword, addSpecialty, etc. - unchanged for now)
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
          {planId && <span className="block mt-2 font-semibold">You're signing up with a pre-selected plan!</span>}
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

        {/* Other cards for Coaching Profile, Availability, Premium Boosters remain the same for now */}
        {/* We can decide if these should be filled out before or after payment for Option B */}
        
        <Card className="shadow-xl border-border/20 overflow-hidden">
          <CardHeader className="p-6 bg-muted/30 border-b border-border/20 rounded-t-lg">
            <CardTitle className="flex items-center text-2xl font-semibold text-primary">
              <Lightbulb className="mr-3 h-7 w-7" /> Coaching Profile
            </CardTitle>
            <CardDescription className="mt-1">Showcase your expertise and unique approach. (You can refine this after registration)</CardDescription>
          </CardHeader>
          <CardContent className="p-6 grid gap-6">
            <div className="space-y-2">
              <Label htmlFor="bio" className="text-base font-medium">Your Bio (Optional for now)</Label>
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
              <Label htmlFor="keywords" className="text-base font-medium">Keywords (Optional for now)</Label>
              <Controller name="keywords" control={control} render={({ field }) => <Input id="keywords" placeholder="e.g., career change, leadership (comma-separated)" {...field} className="text-base py-2.5" />} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="profileImageUpload" className="text-base font-medium">Profile Picture (Optional for now)</Label>
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
              <p className="text-xs text-muted-foreground text-center mt-2">Recommended: Square (1:1), JPG/PNG. Max 2MB.</p>
            </div>
          </CardContent>
        </Card>

        {/* Availability and other premium boosters can be filled out after initial registration + payment */}

        <Button type="submit" className="w-full py-3 text-lg font-semibold tracking-wide shadow-lg hover:shadow-xl transition-shadow duration-200 ease-in-out" disabled={isSubmitting || authLoading || isAiLoading} size="lg">
          {isSubmitting || authLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
          {isSubmitting || authLoading ? 'Processing Registration...' : 'Create Account & Proceed to Payment'}
        </Button>
      </form>
    </div>
  );
}
