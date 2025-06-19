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
import { useAuth, type SignUpInput } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { uploadProfileImage } from '@/services/imageUpload';
import type { FirestoreUserProfile } from '@/types';
import { Badge } from '@/components/ui/badge';
import getStripe from '@/lib/stripe';
import { getFunctions, httpsCallable, Functions } from 'firebase/functions';
import { firebaseApp } from '@/lib/firebase';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
// Import Checkbox
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'; // Added for testimonials

const YOUR_DEFAULT_PREMIUM_PRICE_ID = "price_1RbHz1G028VJJAft7M0DUoUF";
const LOCAL_STORAGE_KEY = 'registerCoachFormData';

interface RegisterCoachFormProps {
  planId?: string | null;
}

const availabilitySlotSchema = z.object({
  day: z.string().min(1, 'Day is required.').max(50, 'Day seems too long.'),
  time: z.string().min(1, 'Time is required.').max(50, 'Time seems too long.'),
});

// Update: Add terms (must be true) to the schema
const coachRegistrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string(),
  bio: z.string().min(50, 'Bio must be at least 50 characters for AI suggestions.').optional().or(z.literal('')),
  selectedSpecialties: z.array(z.string()).min(1, 'Please select or add at least one specialty.'),
  // Testimonials are handled separately and not part of the main Zod schema for form validation directly with RHF submit
  // but individual entries will be validated before attempting to add them to the API.
  keywords: z.string().optional(),
  certifications: z.string().optional(),
  location: z.string().optional(),
  profileImageUrl: z.string().url('Profile image URL must be a valid URL.').optional().or(z.literal('')).nullable(),
  websiteUrl: z.string().url('Invalid URL for website.').optional().or(z.literal('')),
  introVideoUrl: z.string().url('Invalid URL for intro video.').optional().or(z.literal('')),
  socialLinkPlatform: z.string().optional(),
  socialLinkUrl: z.string().url('Invalid URL for social link.').optional().or(z.literal('')),
  availability: z.array(availabilitySlotSchema).min(1, "Please add at least one availability slot.").optional().default([]),
  terms: z.literal(true, {
    errorMap: () => ({
      message: 'You must accept the Terms and Conditions.',
    }),
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type CoachRegistrationFormData = z.infer<typeof coachRegistrationSchema>;

export default function RegisterCoachForm({ planId }: RegisterCoachFormProps) {
  const router = useRouter();
  const { signup, loading: authLoading, getFirebaseAuthToken } = useAuth(); // Added getFirebaseAuthToken
  const isFreeTier = !planId; // If planId is null, undefined, or an empty string, it's a free tier.
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestCoachSpecialtiesOutput | null>(null);
  const [customSpecialtyInput, setCustomSpecialtyInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newSlotDay, setNewSlotDay] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('');

  // State for testimonials
  const [testimonialEntries, setTestimonialEntries] = useState([{ clientName: '', testimonialText: '' }]);
  const MAX_TESTIMONIALS = 10;

  // Zod schema for a single testimonial entry (for local validation before adding to API)
  const testimonialEntrySchema = z.object({
    clientName: z.string().min(1, "Client's name is required.").max(100, "Name too long."),
    testimonialText: z.string().min(10, "Testimonial text must be at least 10 characters.").max(1000, "Text too long."),
  });

  const getInitialFormValues = () => {
    try {
      const upgradeAttempt = localStorage.getItem('coachFormUpgradeAttempt') === 'true';
      const storedDataString = localStorage.getItem(LOCAL_STORAGE_KEY);

      if (upgradeAttempt) { // If an upgrade was just attempted
        localStorage.removeItem('coachFormUpgradeAttempt'); // Clear the flag
        if (storedDataString) {
          console.log('Loading form data from local storage (upgrade attempt)'); // Debug
          return { ...JSON.parse(storedDataString), terms: false };
        }
      } else if (!planId && storedDataString) { // If it's free tier (no planId) and data exists
        console.log('Loading form data from local storage (free tier session)'); // Debug
        return { ...JSON.parse(storedDataString), terms: false };
      }
    } catch (error) {
      console.error("Error loading/parsing data from local storage:", error);
      // Fall through to default if error
    }
    // Standard empty default values:
    return {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      bio: '',
      selectedSpecialties: [],
      keywords: '',
      certifications: '',
      location: '',
      profileImageUrl: null, // Ensure this matches Zod schema (optional, nullable)
      websiteUrl: '',
      introVideoUrl: '',
      socialLinkPlatform: '',
      socialLinkUrl: '',
      availability: [],
      terms: false, // <-- Add initial value for terms
    };
  };

  const initialFormValues = getInitialFormValues();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CoachRegistrationFormData>({
    resolver: zodResolver(coachRegistrationSchema),
    defaultValues: initialFormValues,
  });

  const watchedValues = watch(); // Watch all fields

  useEffect(() => {
    const debouncedSave = debounce((dataToSave) => {
      if (isFreeTier) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
        console.log('Form data saved to local storage (free tier)'); // For debugging
      }
    }, 1000); // Debounce for 1 second

    debouncedSave(watchedValues);

    // Cleanup function for the debounce if the component unmounts or dependencies change
    return () => {
      debouncedSave.cancel();
    };
  }, [watchedValues, isFreeTier]); // Re-run if watchedValues or isFreeTier changes

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
      
      const registeredUser = await signup(
        data.name,
        data.email,
        data.password,
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

        // Update user profile with image URL in Firestore
        if (finalProfileImageUrl) { // createdUserId is already confirmed by outer if
          try {
            const db = getFirestore(firebaseApp);
            const userDocRef = doc(db, 'users', createdUserId);
            await updateDoc(userDocRef, {
              photoURL: finalProfileImageUrl
            });
            console.log('User profile updated with image URL in Firestore.');
            // Optionally, add a success toast here if desired
          } catch (updateError) {
            console.error('Error updating user profile with image URL:', updateError);
            toast({
              title: 'Profile Image Update Failed',
              description: 'Your account was created, but we couldn\'t save your profile picture. Please try updating it from your profile settings.',
              variant: 'warning',
              duration: 8000,
            });
          }
        }
      }
      
      // --- Process Testimonials (Option B) ---
      if (!isFreeTier && testimonialEntries.length > 0 && createdUserId) {
        const authToken = await getFirebaseAuthToken();
        if (authToken) {
          let successfulTestimonials = 0;
          let failedTestimonials = 0;
          toast({ title: 'Submitting testimonials...', description: 'Please wait while we process your testimonials.'});

          for (const entry of testimonialEntries) {
            const validationResult = testimonialEntrySchema.safeParse(entry);
            // Only submit if the entry is valid AND has actual content (not just empty strings)
            if (validationResult.success && validationResult.data.clientName.trim() && validationResult.data.testimonialText.trim()) {
              try {
                const response = await fetch('/api/coachtestimonials', { // UPDATED
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                  },
                  body: JSON.stringify({
                    coachId: createdUserId,
                    clientName: validationResult.data.clientName.trim(),
                    testimonialText: validationResult.data.testimonialText.trim(),
                  }),
                });
                if (response.ok) {
                  successfulTestimonials++;
                } else {
                  failedTestimonials++;
                  console.warn(`Failed to submit testimonial for ${validationResult.data.clientName}: ${response.statusText}`);
                }
              } catch (testimonialError) {
                failedTestimonials++;
                console.error(`Error submitting testimonial for ${validationResult.data.clientName}:`, testimonialError);
              }
            } else if (entry.clientName.trim() !== '' || entry.testimonialText.trim() !== '') {
              // Count as failed if user entered something but it was invalid or became empty after trim
              failedTestimonials++;
              console.warn("Skipping invalid or incomplete testimonial entry during submission:", validationResult.error?.flatten().fieldErrors || "Entry was empty or invalid.");
            }
          }
          if (successfulTestimonials > 0 || failedTestimonials > 0) { // Show toast only if submissions were attempted
             toast({
                title: 'Testimonials Submission Complete',
                description: `${successfulTestimonials} testimonial(s) submitted successfully. ${failedTestimonials > 0 ? `${failedTestimonials} failed or skipped.` : ''}`,
                variant: failedTestimonials > 0 ? 'warning' : 'success',
                duration: failedTestimonials > 0 ? 8000 : 5000, // Longer duration if there were issues
             });
          }
        } else {
          toast({ title: 'Authentication Error', description: 'Could not submit testimonials due to missing auth token. Please add them later from your dashboard.', variant: 'destructive', duration: 8000 });
        }
      }
      // --- End Process Testimonials ---

      toast({
        title: 'Account Created Successfully',
        description: 'Your coach account is now active.',
        variant: 'success',
      });
      

      if (planId && createdUserId) {
        toast({ title: "Redirecting to subscription...", description: "Please wait." });
        const functionsInstance: Functions = getFunctions(firebaseApp);
        const createCheckoutSession = httpsCallable(functionsInstance, 'createCheckoutSessionCallable');
        
        const successUrl = `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${window.location.origin}/payment-cancelled`;

        const { data: checkoutData }: any = await createCheckoutSession({
          priceId: planId,
          successUrl: successUrl, // <-- ADD THIS LINE
          cancelUrl: cancelUrl,   // <-- ADD THIS LINE
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
      // Clear Local Storage after successful operations, before final navigation for non-Stripe path
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        localStorage.removeItem('coachFormUpgradeAttempt'); // Also clear the upgrade flag
        console.log('Local storage cleared after successful submission.'); // Debug
      } catch (error) {
        console.error("Error clearing local storage:", error);
        // Non-critical, so don't let this break the flow
      }
      router.push('/dashboard/coach');
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

  const handleUpgradeToPremium = async () => {
    // Get current form values
    const currentFormData = getValues(); // getValues() from react-hook-form

    // Save current form data to local storage immediately
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentFormData));
      console.log('Form data saved to local storage before upgrade attempt'); // Debug
    } catch (error) {
      console.error("Error saving data to local storage before upgrade:", error);
      // Proceed with navigation even if save fails, but log it.
    }

    // Set the upgrade attempt flag
    localStorage.setItem('coachFormUpgradeAttempt', 'true');
    console.log('Upgrade attempt flag set'); // Debug

    // Navigate to the premium registration page
    router.push(`/register-coach?planId=${YOUR_DEFAULT_PREMIUM_PRICE_ID}`);
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
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isFreeTier}>
                        <UploadCloud className="mr-2 h-4 w-4" /> {selectedFile ? 'Change Image' : 'Upload Image'}
                    </Button>
                    <input 
                        type="file" 
                        id="profileImageUpload" 
                        className="hidden" 
                        accept="image/png, image/jpeg, image/jpg" 
                        onChange={handleImageChange} 
                        ref={fileInputRef}
                        disabled={isFreeTier}
                    />
                    {!isFreeTier && imagePreviewUrl && (
                        <Button type="button" variant="ghost" size="icon" onClick={handleRemoveImage} aria-label="Remove image"> 
                        <Trash2 className="h-5 w-5 text-destructive" />
                        </Button>
                    )}
                    </div>
                    {isFreeTier && (
                      <div className="text-center p-4 mt-3 border border-custom-gold bg-light-gold-bg rounded-md">
                        <Crown className="h-6 w-6 text-custom-gold mx-auto mb-2" />
                        <p className="text-sm text-neutral-700 mb-3">Profile Picture is a Premium Feature.</p>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-custom-gold text-custom-gold hover:bg-custom-gold hover:text-white"
                          onClick={handleUpgradeToPremium}
                        >
                          Upgrade to Unlock
                        </Button>
                      </div>
                    )}
                </div>
                {errors.profileImageUrl && <p className="text-sm text-destructive mt-1">{errors.profileImageUrl.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="websiteUrl" className="text-base font-medium flex items-center"><LinkIcon className="mr-2 h-5 w-5 text-primary/80" />Website URL</Label>
              <Controller name="websiteUrl" control={control} render={({ field }) => <Input id="websiteUrl" type="url" placeholder="https://yourwebsite.com" {...field} className="text-base py-2.5" disabled={isFreeTier} />} />
              {errors.websiteUrl && <p className="text-sm text-destructive mt-1">{errors.websiteUrl.message}</p>}
              {isFreeTier && (
                <div className="text-center p-3 mt-2 border border-custom-gold bg-light-gold-bg rounded-md">
                  <Sparkles className="h-5 w-5 text-custom-gold mx-auto mb-1" />
                  <p className="text-xs text-neutral-700 mb-2">Adding a Website URL is a Premium Feature.</p>
                  <Button
                    type="button"
                    size="xs" /* Slightly smaller button for these individual field upgrades */
                    variant="outline"
                    className="border-custom-gold text-custom-gold hover:bg-custom-gold hover:text-white"
                    onClick={handleUpgradeToPremium}
                  >
                    Upgrade
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="introVideoUrl" className="text-base font-medium flex items-center"><Video className="mr-2 h-5 w-5 text-primary/80" />Intro Video URL (e.g., YouTube, Vimeo)</Label>
              <Controller name="introVideoUrl" control={control} render={({ field }) => <Input id="introVideoUrl" type="url" placeholder="https://youtube.com/yourvideo" {...field} className="text-base py-2.5" disabled={isFreeTier} />} />
              {errors.introVideoUrl && <p className="text-sm text-destructive mt-1">{errors.introVideoUrl.message}</p>}
              {isFreeTier && (
                <div className="text-center p-3 mt-2 border border-custom-gold bg-light-gold-bg rounded-md">
                  <Sparkles className="h-5 w-5 text-custom-gold mx-auto mb-1" />
                  <p className="text-xs text-neutral-700 mb-2">Adding an Intro Video is a Premium Feature.</p>
                  <Button
                    type="button"
                    size="xs" /* Slightly smaller button */
                    variant="outline"
                    className="border-custom-gold text-custom-gold hover:bg-custom-gold hover:text-white"
                    onClick={handleUpgradeToPremium}
                  >
                    Upgrade
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="socialLinkPlatform" className="text-base font-medium">Social Media Platform</Label>
                <Controller name="socialLinkPlatform" control={control} render={({ field }) => <Input id="socialLinkPlatform" placeholder="e.g., LinkedIn, Twitter" {...field} className="text-base py-2.5" disabled={isFreeTier} />} />
                {errors.socialLinkPlatform && <p className="text-sm text-destructive mt-1">{errors.socialLinkPlatform.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="socialLinkUrl" className="text-base font-medium">Social Media URL</Label>
                <Controller name="socialLinkUrl" control={control} render={({ field }) => <Input id="socialLinkUrl" type="url" placeholder="https://linkedin.com/in/yourprofile" {...field} className="text-base py-2.5" disabled={isFreeTier} />} />
                {errors.socialLinkUrl && <p className="text-sm text-destructive mt-1">{errors.socialLinkUrl.message}</p>}
              </div>
              {isFreeTier && (
                <div className="md:col-span-2 text-center p-4 mt-3 border border-custom-gold bg-light-gold-bg rounded-md">
                  <LinkIcon className="h-6 w-6 text-custom-gold mx-auto mb-2" />
                  <p className="text-sm text-neutral-700 mb-3">Adding Social Media Links is a Premium Feature.</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-custom-gold text-custom-gold hover:bg-custom-gold hover:text-white"
                    onClick={handleUpgradeToPremium}
                  >
                    Upgrade to Unlock
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-border/20 overflow-hidden">
          <CardHeader className="p-6 bg-muted/30 border-b border-border/20 rounded-t-lg">
            <CardTitle className="flex items-center text-2xl font-semibold text-primary">
              <CalendarDays className="mr-3 h-7 w-7" /> Your Availability
            </CardTitle>
            <CardDescription className="mt-1">{'Let clients know when you\'re available. You can update your availability anytime in Coach dashboard'}</CardDescription>
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
              <Button type="button" variant="outline" onClick={handleAddAvailabilitySlot} className="whitespace-nowrap shrink-0" disabled={!newSlotDay.trim() || !newSlotTime.trim()}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Slot
              </Button>
            </div>
            {errors.availability && typeof errors.availability === 'object' && 'message' in errors.availability && (
                <p className="text-sm text-destructive mt-2">{errors.availability.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Testimonials Section - Conditional for Premium */}
        {!isFreeTier && (
          <Card className="shadow-xl border-border/20 overflow-hidden">
            <Accordion type="single" collapsible className="w-full" defaultValue="item-1">
                <AccordionItem value="item-1" className="border-b-0">
                    <AccordionTrigger className="p-6 bg-muted/30 hover:no-underline !rounded-t-lg">
                        <div className="flex items-center text-2xl font-semibold text-primary w-full justify-between">
                            <div className="flex items-center">
                                <Star className="mr-3 h-7 w-7 text-yellow-400 fill-yellow-400" /> Initial Client Testimonials (Optional)
                            </div>
                            {/* Chevron will be part of AccordionTrigger */}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0 border-t border-border/20"> {/* Border added to content top instead of item bottom */}
                        <CardHeader className="px-6 pt-4 pb-2">
                             <CardDescription>
                                Boost your premium profile by adding up to {MAX_TESTIMONIALS} client testimonials. You can add more or manage these later from your coach dashboard.
                                Only filled-in testimonials will be saved.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 pt-2 space-y-6">
                          {testimonialEntries.map((entry, index) => (
                            <div key={index} className="p-4 border rounded-md space-y-3 relative bg-background shadow-sm">
                              <div className="flex justify-between items-center mb-2">
                                <Label className="text-base font-medium">Testimonial #{index + 1}</Label>
                                {(testimonialEntries.length > 1 || (testimonialEntries.length === 1 && (entry.clientName.trim() !== '' || entry.testimonialText.trim() !== ''))) && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      const newEntries = testimonialEntries.filter((_, i) => i !== index);
                                      // If all removed, add one blank one back
                                      setTestimonialEntries(newEntries.length > 0 ? newEntries : [{ clientName: '', testimonialText: '' }]);
                                    }}
                                    className="text-destructive hover:bg-destructive/10"
                                    aria-label="Remove testimonial"
                                  >
                                    <Trash2 className="h-5 w-5" />
                                  </Button>
                                )}
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`testimonialClientName-${index}`}>Client&apos;s Name</Label>
                                <Input
                                  id={`testimonialClientName-${index}`}
                                  placeholder="Client's Full Name"
                                  value={entry.clientName}
                                  onChange={(e) => {
                                    const newEntries = [...testimonialEntries];
                                    newEntries[index].clientName = e.target.value;
                                    setTestimonialEntries(newEntries);
                                  }}
                                  className="text-base"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor={`testimonialText-${index}`}>Testimonial Text</Label>
                                <Textarea
                                  id={`testimonialText-${index}`}
                                  placeholder="Enter client's testimonial..."
                                  value={entry.testimonialText}
                                  onChange={(e) => {
                                    const newEntries = [...testimonialEntries];
                                    newEntries[index].testimonialText = e.target.value;
                                    setTestimonialEntries(newEntries);
                                  }}
                                  rows={3}
                                  className="text-base"
                                />
                              </div>
                            </div>
                          ))}
                          {testimonialEntries.length < MAX_TESTIMONIALS && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                if (testimonialEntries.length < MAX_TESTIMONIALS) {
                                  setTestimonialEntries([...testimonialEntries, { clientName: '', testimonialText: '' }]);
                                }
                              }}
                              className="mt-2"
                            >
                              <PlusCircle className="mr-2 h-4 w-4" /> Add Testimonial
                            </Button>
                          )}
                        </CardContent>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
          </Card>
        )}
        {/* End Testimonials Section */}

        {/* Terms and Conditions Checkbox */}
        <div className="flex items-start gap-3 p-4 border border-border/20 rounded-lg bg-muted/20">
          <Controller
            name="terms"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="terms"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <div>
            <Label htmlFor="terms" className="font-medium text-base cursor-pointer">
              I agree to the{' '}
              <Link href="/terms-and-conditions" target="_blank" className="underline text-primary hover:text-primary/80">
                Terms and Conditions
              </Link>
              .
            </Label>
            {errors.terms && (
              <p className="text-sm text-destructive mt-1">
                {errors.terms.message}
              </p>
            )}
          </div>
        </div>

        <Button type="submit" className="w-full py-3 text-lg font-semibold tracking-wide shadow-lg hover:shadow-xl transition-shadow duration-200 ease-in-out" disabled={isSubmitting || authLoading || isAiLoading} size="lg">
          {isSubmitting || authLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
          {isSubmitting || authLoading ? 'Processing Registration...' : (isFreeTier ? 'Create Free Account' : 'Create Account & Proceed to Payment')}
        </Button>
      </form>
    </div>
  );
}