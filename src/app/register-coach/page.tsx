"use client";

import { useState, useEffect, useCallback, type ChangeEvent, useRef } from 'react';
import { useForm, Controller, type SubmitHandler, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
// Checkbox no longer needed for availability
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserPlus, Lightbulb, X, Crown, CalendarDays, Sparkles, PlusCircle, Image as ImageIcon, UploadCloud, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { suggestCoachSpecialties, type SuggestCoachSpecialtiesOutput } from '@/ai/flows/suggest-coach-specialties';
import { debounce } from 'lodash';
import Link from 'next/link';
import NextImage from 'next/image';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { setUserProfile } from '@/lib/firestore';
import { uploadProfileImage } from '@/services/imageUpload';
import type { FirestoreUserProfile } from '@/types'; // CoachAvailability removed as it will be redefined locally by the schema
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";

// New availability slot schema
const availabilitySlotSchema = z.object({
  day: z.string().min(1, 'Day is required.').max(50, 'Day seems too long.'),
  time: z.string().min(1, 'Time is required.').max(50, 'Time seems too long.'),
});

const coachRegistrationSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'),
  bio: z.string().min(50, 'Bio must be at least 50 characters for AI suggestions.'),
  selectedSpecialties: z.array(z.string()).min(1, 'Please select or add at least one specialty.'),
  keywords: z.string().optional(),
  profileImageUrl: z.string().url('Profile image URL must be a valid URL.').optional().or(z.literal('')).nullable(),
  certifications: z.string().optional(),
  location: z.string().optional(),
  websiteUrl: z.string().url('Invalid URL for website.').optional().or(z.literal('')),
  introVideoUrl: z.string().url('Invalid URL for intro video.').optional().or(z.literal('')),
  socialLinkPlatform: z.string().optional(),
  socialLinkUrl: z.string().url('Invalid URL for social link.').optional().or(z.literal('')),
  // Updated availability schema
  availability: z.array(availabilitySlotSchema).optional().default([]),
  status: z.string().optional(),
});

type CoachRegistrationFormData = z.infer<typeof coachRegistrationSchema>;

export default function RegisterCoachPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestCoachSpecialtiesOutput | null>(null);
  const [customSpecialtyInput, setCustomSpecialtyInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State for new availability slot input
  const [newSlotDay, setNewSlotDay] = useState('');
  const [newSlotTime, setNewSlotTime] = useState('');

  const defaultNameFromQuery = searchParams.get('name') || '';
  const defaultEmailFromQuery = searchParams.get('email') || '';

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
      name: defaultNameFromQuery,
      email: defaultEmailFromQuery,
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
      availability: [], // Default to empty array for the new structure
      status: 'pending_approval',
    },
  });

  const { fields: availabilityFields, append: appendAvailability, remove: removeAvailability } = useFieldArray({
    control,
    name: "availability",
  });

  useEffect(() => {
    const nameFromQuery = searchParams.get('name');
    const emailFromQuery = searchParams.get('email');

    if (user) {
      reset({
        name: nameFromQuery || user.displayName || '',
        email: emailFromQuery || user.email || '',
        bio: '',
        selectedSpecialties: [],
        keywords: '',
        certifications: '',
        location: '',
        profileImageUrl: user.photoURL || null,
        websiteUrl: '',
        introVideoUrl: '',
        socialLinkPlatform: '',
        socialLinkUrl: '',
        availability: [], // Reset to empty array
        status: 'pending_approval',
      });
    } else if (nameFromQuery || emailFromQuery) {
      reset(prev => ({
        ...prev,
        name: nameFromQuery || prev.name,
        email: emailFromQuery || prev.email,
      }));
    }
  }, [user, reset, searchParams]);

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
    if (bioValue) {
      debouncedFetchSuggestions(bioValue);
    }
  }, [bioValue, debouncedFetchSuggestions]);

  const onSubmit: SubmitHandler<CoachRegistrationFormData> = async (data) => {
    if (!user || !user.id) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to register as a coach.",
        variant: "destructive",
      });
      return;
    }

    let finalProfileImageUrl = data.profileImageUrl || null;

    try {
      if (selectedFile) {
        toast({ title: 'Uploading profile image...', description: 'Please wait.' });
        finalProfileImageUrl = await uploadProfileImage(selectedFile, user.id, data.profileImageUrl || null);
      }

      const profileDataToSave = {
        ...data,
        profileImageUrl: finalProfileImageUrl,
        status: 'pending_approval',
        userId: user.id,
        // Ensure availability is an array, even if undefined from form data
        availability: data.availability || [], 
      };

      await setUserProfile(user.id, profileDataToSave as unknown as FirestoreUserProfile);
      
      toast({
        title: 'Registration Submitted!',
        description: 'Your profile is pending approval. We will notify you once it is reviewed.',
        variant: 'success',
      });
      reset(); 
      setSelectedFile(null);
      setImagePreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      router.push('/dashboard/coach/profile'); // Redirect to profile page
    } catch (error) {
      console.error('Error during coach registration:', error);
      toast({
        title: 'Registration Failed',
        description: (error as Error).message || 'There was an error submitting your profile. Please try again.',
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
        </p>
      </section>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Personal Information Card ... */}
        <Card className="shadow-xl border-border/20 overflow-hidden">
          <CardHeader className="p-6 bg-muted/30 border-b border-border/20 rounded-t-lg">
            <CardTitle className="flex items-center text-2xl font-semibold text-primary">
              <UserPlus className="mr-3 h-7 w-7" /> Personal Information
            </CardTitle>
            <CardDescription className="mt-1">Let's start with the basics.</CardDescription>
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
          </CardContent>
        </Card>

        {/* Coaching Profile Card ... */}
        <Card className="shadow-xl border-border/20 overflow-hidden">
          <CardHeader className="p-6 bg-muted/30 border-b border-border/20 rounded-t-lg">
            <CardTitle className="flex items-center text-2xl font-semibold text-primary">
              <Lightbulb className="mr-3 h-7 w-7" /> Coaching Profile
            </CardTitle>
            <CardDescription className="mt-1">Showcase your expertise and unique approach.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 grid gap-6">
            {/* Bio, Specialties, Keywords, Certifications, Location ... */}
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
              <p className="text-xs text-muted-foreground">Separate with commas. Helps clients find you.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="certifications" className="text-base font-medium">Certifications (Optional)</Label>
              <Controller name="certifications" control={control} render={({ field }) => <Input id="certifications" placeholder="e.g., ICF Certified Coach, PCC" {...field} className="text-base py-2.5" />} />
              {errors.certifications && <p className="text-sm text-destructive mt-1">{errors.certifications.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="text-base font-medium">Location (Optional)</Label>
              <Controller name="location" control={control} render={({ field }) => <Input id="location" placeholder="e.g., New York, NY or Remote" {...field} className="text-base py-2.5" />} />
              {errors.location && <p className="text-sm text-destructive mt-1">{errors.location.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* NEW Availability Card */}
        <Card className="shadow-xl border-border/20 overflow-hidden">
          <CardHeader className="p-6 bg-muted/30 border-b border-border/20 rounded-t-lg">
            <CardTitle className="flex items-center text-2xl font-semibold text-primary">
              <CalendarDays className="mr-3 h-7 w-7" /> Weekly Availability
            </CardTitle>
            <CardDescription className="mt-1">
              Specify days and time frames you are available. E.g., Day: Monday, Time: 10am - 1pm.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-4">
              {availabilityFields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-3 p-3 border rounded-md bg-muted/50">
                  <Input
                    {...control.register(`availability.${index}.day`)}
                    placeholder="Day (e.g., Monday)"
                    className="flex-1 py-2.5"
                    defaultValue={field.day}
                  />
                  <Input
                    {...control.register(`availability.${index}.time`)}
                    placeholder="Time (e.g., 9am - 5pm)"
                    className="flex-1 py-2.5"
                    defaultValue={field.time}
                  />
                  <Button type="button" variant="ghost" onClick={() => removeAvailability(index)} size="icon" className="text-destructive hover:text-destructive/80">
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              ))}
              {errors.availability && typeof errors.availability === 'object' && !Array.isArray(errors.availability) && errors.availability.root && (
                 <p className="text-sm text-destructive mt-1">{errors.availability.root.message}</p>
              )}
               {Array.isArray(errors.availability) && errors.availability.map((err, i) => (
                <div key={i} className="text-sm text-destructive">
                  {err?.day && <p>Slot {i+1} Day: {err.day.message}</p>}
                  {err?.time && <p>Slot {i+1} Time: {err.time.message}</p>}
                </div>
              ))}
            </div>

            <div className="flex items-end gap-3 pt-4 border-t">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="newSlotDayInput" className="text-sm font-medium">Day</Label>
                <Input 
                  id="newSlotDayInput" 
                  placeholder="e.g., Monday" 
                  value={newSlotDay} 
                  onChange={(e) => setNewSlotDay(e.target.value)} 
                  className="py-2.5"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="newSlotTimeInput" className="text-sm font-medium">Time Frame</Label>
                <Input 
                  id="newSlotTimeInput" 
                  placeholder="e.g., 10am - 1pm" 
                  value={newSlotTime} 
                  onChange={(e) => setNewSlotTime(e.target.value)} 
                  className="py-2.5"
                />
              </div>
              <Button type="button" variant="outline" onClick={handleAddAvailabilitySlot} className="shrink-0">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Slot
              </Button>
            </div>
            {errors.availability && typeof errors.availability.message === 'string' && (
              <p className="text-sm text-destructive mt-1">{errors.availability.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Premium Profile Boosters Card ... */}
        <Card className="shadow-xl border-border/20 overflow-hidden">
          <CardHeader className="p-6 bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 border-b border-border/20 rounded-t-lg">
            <CardTitle className="flex items-center text-2xl font-semibold text-primary-foreground"><Crown className="mr-3 h-7 w-7" /> Premium Profile Boosters</CardTitle>
            <CardDescription className="mt-1 text-primary-foreground/90">Supercharge your profile with these premium features.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 grid gap-6">
            {/* Profile Picture, Website, Intro Video, Social Link ... */}
            <div className="space-y-2">
              <Label htmlFor="profileImageUpload" className="text-base font-medium">Profile Picture</Label>
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
            <div className="space-y-2">
              <Label htmlFor="websiteUrl" className="text-base font-medium">Website URL</Label>
              <Controller name="websiteUrl" control={control} render={({ field }) => <Input id="websiteUrl" placeholder="https://yourpersonalsite.com" {...field} className="text-base py-2.5" />} />
              {errors.websiteUrl && <p className="text-sm text-destructive mt-1">{errors.websiteUrl.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="introVideoUrl" className="text-base font-medium">Intro Video URL</Label>
              <Controller name="introVideoUrl" control={control} render={({ field }) => <Input id="introVideoUrl" placeholder="https://youtube.com/watch?v=yourvideo" {...field} className="text-base py-2.5" />} />
              {errors.introVideoUrl && <p className="text-sm text-destructive mt-1">{errors.introVideoUrl.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="socialLinkUrl" className="text-base font-medium">Primary Social Link</Label>
              <Controller name="socialLinkUrl" control={control} render={({ field }) => <Input id="socialLinkUrl" placeholder="https://linkedin.com/in/yourprofile" {...field} className="text-base py-2.5" />} />
              {errors.socialLinkUrl && <p className="text-sm text-destructive mt-1">{errors.socialLinkUrl.message}</p>}
            </div>
            <div className="mt-4 pt-6 border-t border-border/20 text-center col-span-full">
              <Link 
                href="/pricing" 
                className={cn(
                  buttonVariants({ size: "lg" }), 
                  "inline-flex items-center shadow-md hover:shadow-lg transition-shadow duration-200 ease-in-out group",
                  "bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 hover:from-yellow-500 hover:via-yellow-600 hover:to-orange-600 text-primary-foreground"
                )}
              >
                <Crown className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform duration-200" /> Get Premium
              </Link>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full py-3 text-lg font-semibold tracking-wide shadow-lg hover:shadow-xl transition-shadow duration-200 ease-in-out" disabled={isSubmitting || isAiLoading} size="lg">
          {isSubmitting || isAiLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UserPlus className="mr-2 h-5 w-5" />}
          {isSubmitting ? 'Creating Profile...' : (isAiLoading ? 'AI is Working...' : 'Create My Coach Profile')}
        </Button>
      </form>
    </div>
  );
}
