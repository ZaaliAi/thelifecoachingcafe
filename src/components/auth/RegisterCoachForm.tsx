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
import { updateProfile } from 'firebase/auth';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const YOUR_DEFAULT_PREMIUM_PRICE_ID = "price_1RbHz1G028VJJAft7M0DUoUF";
const LOCAL_STORAGE_KEY = 'registerCoachFormData';

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
  socialLinks: z.string().url('Invalid URL for social link.').optional().or(z.literal('')),
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
  const { signup, loading: authLoading, getFirebaseAuthToken } = useAuth();
  const isFreeTier = !planId;
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestCoachSpecialtiesOutput | null>(null);
  const [customSpecialtyInput, setCustomSpecialtyInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newSlotDay, setNewSlotDay] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('');
  const [testimonialEntries, setTestimonialEntries] = useState([{ clientName: '', testimonialText: '' }]);
  const MAX_TESTIMONIALS = 10;

  const testimonialEntrySchema = z.object({
    clientName: z.string().min(1, "Client's name is required.").max(100, "Name too long."),
    testimonialText: z.string().min(10, "Testimonial text must be at least 10 characters.").max(1000, "Text too long."),
  });
  
  const getInitialFormValues = () => {
    try {
      const upgradeAttempt = localStorage.getItem('coachFormUpgradeAttempt') === 'true';
      const storedDataString = localStorage.getItem(LOCAL_STORAGE_KEY);

      if (upgradeAttempt) {
        localStorage.removeItem('coachFormUpgradeAttempt');
        if (storedDataString) {
          return { ...JSON.parse(storedDataString), terms: false };
        }
      } else if (!planId && storedDataString) {
        return { ...JSON.parse(storedDataString), terms: false };
      }
    } catch (error) {
      console.error("Error loading/parsing data from local storage:", error);
    }
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
      profileImageUrl: null,
      websiteUrl: '',
      introVideoUrl: '',
      socialLinkPlatform: '',
      socialLinks: '',
      availability: [],
      terms: false,
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

  const watchedValues = watch();

  useEffect(() => {
    const debouncedSave = debounce((dataToSave) => {
      if (isFreeTier) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
      }
    }, 1000);

    debouncedSave(watchedValues);

    return () => {
      debouncedSave.cancel();
    };
  }, [watchedValues, isFreeTier]);

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
      const { password, confirmPassword, socialLinkPlatform, socialLinks, ...profileDetails } = data;
      
      let additionalDataForAuth: Partial<FirestoreUserProfile> = {
        ...profileDetails,
        planId: planId || undefined,
        specialties: data.selectedSpecialties,
        availability: data.availability,
        socialLinks: [],
      };

      if (socialLinkPlatform && socialLinks) {
        additionalDataForAuth.socialLinks = [{ platform: socialLinkPlatform, url: socialLinks }];
      }

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
        
        if (finalProfileImageUrl) {
          try {
            const db = getFirestore(firebaseApp);
            const userDocRef = doc(db, 'users', createdUserId);
            await updateDoc(userDocRef, {
              profileImageUrl: finalProfileImageUrl
            });
            
            if (registeredUser) {
              await updateProfile(registeredUser, { photoURL: finalProfileImageUrl });
            }
          } catch (updateError) {
            console.error('Error updating user profile with image URL:', updateError);
            toast({
              title: 'Profile Image Update Failed',
              description: `Your account was created, but we couldn't save your profile picture. Please try updating it from your profile settings.`,
              variant: 'warning',
              duration: 8000,
            });
          }
        }
      }
      
      if (!isFreeTier && testimonialEntries.length > 0 && createdUserId) {
        const authToken = await getFirebaseAuthToken();
        if (authToken) {
          let successfulTestimonials = 0;
          let failedTestimonials = 0;
          toast({ title: 'Submitting testimonials...', description: 'Please wait.'});

          for (const entry of testimonialEntries) {
            const validationResult = testimonialEntrySchema.safeParse(entry);
            if (validationResult.success && validationResult.data.clientName.trim() && validationResult.data.testimonialText.trim()) {
              try {
                const response = await fetch('/api/coachtestimonials', {
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
                }
              } catch (testimonialError) {
                failedTestimonials++;
              }
            }
          }
          if (successfulTestimonials > 0 || failedTestimonials > 0) {
             toast({
                title: 'Testimonials Submission Complete',
                description: `${successfulTestimonials} submitted. ${failedTestimonials > 0 ? `${failedTestimonials} failed.` : ''}`,
                variant: failedTestimonials > 0 ? 'warning' : 'success',
             });
          }
        }
      }

      toast({
        title: 'Account Created Successfully!',
        variant: 'success',
      });
      
      if (planId && createdUserId) {
        toast({ title: "Redirecting to subscription..." });
        const functionsInstance: Functions = getFunctions(firebaseApp);
        const createCheckoutSession = httpsCallable(functionsInstance, 'createCheckoutSessionCallable');
        
        const successUrl = `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${window.location.origin}/payment-cancelled`;

        const { data: checkoutData }: any = await createCheckoutSession({
          priceId: planId,
          successUrl: successUrl,
          cancelUrl: cancelUrl,
        });
                
        if (checkoutData.error) {
          throw new Error(checkoutData.error.message);
        }

        if (checkoutData.sessionId) {
          const stripe = await getStripe();
          if (stripe) {
            await stripe.redirectToCheckout({ sessionId: checkoutData.sessionId });
            return;
          }
        }
      }
      
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      router.push('/dashboard/coach');

    } catch (error: any) {
      console.error('Error during coach registration:', error);
      toast({
        title: 'Registration Failed',
        description: error.message || 'An unexpected error occurred.',
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
        description: "Please enter both day and time.",
        variant: "destructive"
      });
    }
  };

  const handleUpgradeToPremium = async () => {
    const currentFormData = getValues();
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(currentFormData));
      localStorage.setItem('coachFormUpgradeAttempt', 'true');
      router.push(`/register-coach?planId=${YOUR_DEFAULT_PREMIUM_PRICE_ID}`);
    } catch (error) {
      console.error("Error saving data for upgrade:", error);
    }
  };

  return (
    <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-3xl bg-background">
      <section className="mb-12 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight">Register as a Coach</h1>
        <p className="mt-4 text-lg text-muted-foreground">Join our community of talented coaches.</p>
        {planId && <p className="mt-2 font-semibold">You're signing up as a Premium User</p>}
      </section>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Controller name="name" control={control} render={({ field }) => <Input placeholder="Full Name" {...field} />} />
            {errors.name && <p className="text-destructive">{errors.name.message}</p>}
            
            <Controller name="email" control={control} render={({ field }) => <Input type="email" placeholder="Email" {...field} />} />
            {errors.email && <p className="text-destructive">{errors.email.message}</p>}

            <Controller name="password" control={control} render={({ field }) => <Input type="password" placeholder="Password" {...field} />} />
            {errors.password && <p className="text-destructive">{errors.password.message}</p>}

            <Controller name="confirmPassword" control={control} render={({ field }) => <Input type="password" placeholder="Confirm Password" {...field} />} />
            {errors.confirmPassword && <p className="text-destructive">{errors.confirmPassword.message}</p>}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Coaching Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Controller name="bio" control={control} render={({ field }) => (
                <Textarea placeholder="Your Bio (Min 50 chars for AI)" {...field} rows={6} />
            )} />
            {errors.bio && <p className="text-destructive">{errors.bio.message}</p>}
            {isAiLoading && <p>Analyzing bio...</p>}
            {aiSuggestions && (
              <div>
                <h4>Smart Suggestions</h4>
                <div>
                  <Label>Keywords:</Label>
                  {aiSuggestions.keywords.map(k => <Button key={k} type="button" variant="outline" size="sm" onClick={() => addSuggestedKeyword(k)}>{k}</Button>)} 
                </div>
                <div>
                  <Label>Specialties:</Label>
                  {aiSuggestions.specialties.map(s => <Button key={s} type="button" variant="outline" size="sm" onClick={() => addSpecialty(s)}>{s}</Button>)} 
                </div>
              </div>
            )}

            <div>
              <Label>Your Specialties</Label>
              <div>
                {currentSelectedSpecialties.map(s => <Badge key={s}>{s}<button type="button" onClick={() => removeSpecialty(s)}>x</button></Badge>)} 
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add custom specialty" value={customSpecialtyInput} onChange={e => setCustomSpecialtyInput(e.target.value)} /> 
                <Button type="button" onClick={handleAddCustomSpecialty}>Add</Button> 
              </div>
              {errors.selectedSpecialties && <p className="text-destructive">{errors.selectedSpecialties.message}</p>}
            </div>

            <Controller name="keywords" control={control} render={({ field }) => <Input placeholder="Keywords (e.g., career change, leadership)" {...field} />} />
            <Controller name="certifications" control={control} render={({ field }) => <Input placeholder="Certifications" {...field} />} />
            <Controller name="location" control={control} render={({ field }) => <Input placeholder="Location" {...field} />} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Premium Profile Boosters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
              <div>
                  <Label>Profile Picture</Label>
                  {imagePreviewUrl && <NextImage src={imagePreviewUrl} alt="Preview" width={100} height={100} />}
                  <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={isFreeTier}>Upload Image</Button>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} ref={fileInputRef} disabled={isFreeTier}/>
                  {isFreeTier && (
                    <div>
                      <p>Premium Feature.</p>
                      <Button type="button" onClick={handleUpgradeToPremium}>Upgrade</Button>
                    </div>
                  )}
              </div>
            <Controller name="websiteUrl" control={control} render={({ field }) => <Input type="url" placeholder="Website URL" {...field} disabled={isFreeTier} />} />
            {isFreeTier && <Button type="button" onClick={handleUpgradeToPremium}>Upgrade</Button>}
            
            <Controller name="introVideoUrl" control={control} render={({ field }) => <Input type="url" placeholder="Intro Video URL" {...field} disabled={isFreeTier} />} />
            {isFreeTier && <Button type="button" onClick={handleUpgradeToPremium}>Upgrade</Button>}
            
            <Controller name="socialLinkPlatform" control={control} render={({ field }) => <Input placeholder="Social Media Platform" {...field} disabled={isFreeTier} />} />
            <Controller name="socialLinks" control={control} render={({ field }) => <Input type="url" placeholder="Social Media URL" {...field} disabled={isFreeTier} />} />
            {isFreeTier && <Button type="button" onClick={handleUpgradeToPremium}>Upgrade</Button>}
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Your Availability</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
                {availabilityFields.map((field, index) => (
                    <div key={field.id} className="flex gap-2">
                    <Controller name={`availability.${index}.day`} control={control} render={({ field }) => <Input placeholder="Day" {...field} />} />
                    <Controller name={`availability.${index}.time`} control={control} render={({ field }) => <Input placeholder="Time" {...field} />} />
                    <Button type="button" onClick={() => removeAvailability(index)}>Remove</Button>
                    </div>
                ))}
                <div className="flex gap-2">
                    <Input placeholder="New Day" value={newSlotDay} onChange={(e) => setNewSlotDay(e.target.value)} />
                    <Input placeholder="New Time" value={newSlotTime} onChange={(e) => setNewSlotTime(e.target.value)} />
                    <Button type="button" onClick={handleAddAvailabilitySlot}>Add Slot</Button>
                </div>
            </CardContent>
        </Card>

        {!isFreeTier && (
          <Card>
            <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                    <AccordionTrigger>Initial Client Testimonials</AccordionTrigger>
                    <AccordionContent>
                        <CardHeader>
                            <CardDescription>Boost your profile with testimonials.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {testimonialEntries.map((entry, index) => (
                            <div key={index}>
                              <Label>Testimonial #{index + 1}</Label>
                              <Input placeholder="Client's Name" value={entry.clientName} onChange={(e) => {
                                    const newEntries = [...testimonialEntries];
                                    newEntries[index].clientName = e.target.value;
                                    setTestimonialEntries(newEntries);
                                  }} />
                              <Textarea placeholder="Testimonial Text" value={entry.testimonialText} onChange={(e) => {
                                    const newEntries = [...testimonialEntries];
                                    newEntries[index].testimonialText = e.target.value;
                                    setTestimonialEntries(newEntries);
                                  }} />
                            </div>
                          ))}
                          <Button type="button" onClick={() => setTestimonialEntries([...testimonialEntries, { clientName: '', testimonialText: '' }])}>
                            Add Testimonial
                          </Button>
                        </CardContent>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
          </Card>
        )}

        <div className="flex items-center gap-2">
          <Controller name="terms" control={control} render={({ field }) => (
              <Checkbox id="terms" checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
          <Label htmlFor="terms">
            I agree to the <Link href="/terms-and-conditions" className="underline">Terms and Conditions</Link>.
          </Label>
          {errors.terms && <p className="text-destructive">{errors.terms.message}</p>}
        </div>

        <Button type="submit" disabled={isSubmitting || authLoading}>
          {isSubmitting || authLoading ? 'Processing...' : (isFreeTier ? 'Create Free Account' : 'Proceed to Payment')}
        </Button>
      </form>
    </div>
  );
}
