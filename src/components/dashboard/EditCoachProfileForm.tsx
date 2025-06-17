'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { UserProfile, AvailabilitySlot } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, UploadCloud, Trash2, Image as ImageIcon, PlusCircle, Sparkles, X } from 'lucide-react';
import NextImage from 'next/image';
import { useAuth } from '@/lib/auth';
import { initiateStripeCheckout } from '@/lib/subscriptionUtils';
import { suggestCoachSpecialties, type SuggestCoachSpecialtiesOutput } from '@/ai/flows/suggest-coach-specialties';
import { debounce } from 'lodash';
import { Badge } from '@/components/ui/badge';


// Helper to remove undefined properties from an object
const pruneUndefined = (obj: any) => {
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      newObj[key] = obj[key];
    }
  });
  return newObj;
};

// Helper to prepare array-like fields for string input
const prepareArrayLikeFieldForInput = (fieldData?: string[] | string): string => {
  if (Array.isArray(fieldData)) {
    return fieldData.join(', ');
  }
  if (typeof fieldData === 'string') {
    return fieldData;
  }
  return '';
};

const availabilitySlotSchema = z.object({
  day: z.string().min(1, 'Day is required.'),
  time: z.string().min(1, 'Time slot is required.'),
});

const editCoachProfileSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  bio: z.string().min(50, 'Bio must be at least 50 characters for AI suggestions.').optional().or(z.literal('')),
  selectedSpecialties: z.array(z.string()).min(1, 'Please select or add at least one specialty.'),
  keywords: z.string().optional(),
  certifications: z.string().optional(),
  location: z.string().optional().nullable(),
  websiteUrl: z.string().url({ message: "Invalid URL format" }).optional().or(z.literal('')),
  introVideoUrl: z.string().url({ message: "Invalid URL format" }).optional().or(z.literal('')),
  linkedInUrl: z.string().url({ message: "Invalid URL format" }).optional().or(z.literal('')),
  availability: z.array(availabilitySlotSchema).optional().default([]),
});

type EditCoachProfileFormData = z.infer<typeof editCoachProfileSchema>;

export interface EditProfileFormSubmitData extends Omit<Partial<UserProfile>, 'profileImageUrl' | 'socialLinks' | 'availability' | 'availabilityText' | 'specialties'> {
  name: string;
  bio?: string;
  specialties: string[];
  keywords: string[];
  certifications: string[];
  location?: string | null;
  websiteUrl?: string | null;
  introVideoUrl?: string | null;
  linkedInUrl?: string;
  availability?: AvailabilitySlot[];
  selectedFile?: File | null;
  imageAction: 'keep' | 'replace' | 'remove';
  currentProfileImageUrl?: string | null;
}

interface EditCoachProfileFormProps {
  initialData: Partial<UserProfile>;
  onSubmit: (formData: EditProfileFormSubmitData) => Promise<void>;
  isPremiumCoach: boolean;
}

const commaStringToArray = (str?: string): string[] =>
  str ? str.split(',').map(item => item.trim()).filter(item => item !== '') : [];

interface PremiumFeatureMessageProps {
  featureName: string;
  onUpgradeClick: () => void;
  isUpgrading: boolean;
}

const PremiumFeatureMessage: React.FC<PremiumFeatureMessageProps> = ({ featureName, onUpgradeClick, isUpgrading }) => (
  <p className="text-xs text-muted-foreground mt-1">
    {featureName} is a premium feature.
    <Button
      type="button"
      variant="link"
      size="xs"
      className="p-1 h-auto"
      onClick={onUpgradeClick}
      disabled={isUpgrading}
    >
      {isUpgrading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
      Upgrade to Premium
    </Button>
  </p>
);

export const EditCoachProfileForm: React.FC<EditCoachProfileFormProps> = ({ initialData, onSubmit, isPremiumCoach }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<SuggestCoachSpecialtiesOutput | null>(null);
  const [customSpecialtyInput, setCustomSpecialtyInput] = useState('');

  const { control, handleSubmit, reset, formState: { errors, isSubmitting: rhfIsSubmitting }, getValues, watch, setValue } = useForm<EditCoachProfileFormData>({
    resolver: zodResolver(editCoachProfileSchema),
    defaultValues: {
      name: initialData.name || '',
      bio: initialData.bio || '',
      selectedSpecialties: Array.isArray(initialData.specialties) ? initialData.specialties : [],
      keywords: prepareArrayLikeFieldForInput(initialData.keywords),
      certifications: prepareArrayLikeFieldForInput(initialData.certifications),
      location: initialData.location || null,
      websiteUrl: initialData.websiteUrl || '',
      introVideoUrl: initialData.introVideoUrl || '',
      linkedInUrl: initialData.socialLinks?.find(link => link.platform === 'LinkedIn')?.url || '',
      availability: initialData.availability || [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "availability" });
  const [newAvailabilityDay, setNewAvailabilityDay] = useState('');
  const [newAvailabilityTime, setNewAvailabilityTime] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageAction, setImageAction] = useState<'keep' | 'replace' | 'remove'>('keep');
  const [uiIsSubmitting, setUiIsSubmitting] = useState(false);
  
  const bioValue = watch('bio');
  const currentSelectedSpecialties = watch('selectedSpecialties') || [];

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

  useEffect(() => {
    reset({
      name: initialData.name || '',
      bio: initialData.bio || '',
      selectedSpecialties: Array.isArray(initialData.specialties) ? initialData.specialties : [],
      keywords: prepareArrayLikeFieldForInput(initialData.keywords),
      certifications: prepareArrayLikeFieldForInput(initialData.certifications),
      location: initialData.location || null,
      websiteUrl: initialData.websiteUrl || '',
      introVideoUrl: initialData.introVideoUrl || '',
      linkedInUrl: initialData.socialLinks?.find(link => link.platform === 'LinkedIn')?.url || '',
      availability: initialData.availability || [],
    });
    if (imageAction === 'keep') {
      setSelectedFile(null);
      setImagePreviewUrl(null);
    }
  }, [initialData, reset, imageAction]);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isPremiumCoach) return;
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setImageAction('replace');
    }
  };

  const handleRemoveImage = () => {
    if (!isPremiumCoach) return;
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setImageAction('remove');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUndoImageAction = () => {
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setImageAction('keep');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddAvailabilitySlot = () => {
    if (newAvailabilityDay.trim() && newAvailabilityTime.trim()) {
      append({ day: newAvailabilityDay.trim(), time: newAvailabilityTime.trim() });
      setNewAvailabilityDay('');
      setNewAvailabilityTime('');
    } else {
      toast({ title: "Missing fields", description: "Please enter both day and time for the availability slot.", variant: "destructive" });
    }
  };

  const handleUpgradeClick = async () => {
    if (!user) {
      toast({ title: "Error", description: "You need to be logged in to upgrade.", variant: "destructive" });
      return;
    }
    setIsUpgrading(true);
    const result = await initiateStripeCheckout({
      priceId: "price_1P6g6bHAbH8p1j3J5sY5e5g5", // Replace with your actual premium price ID
      user: user,
    });

    if (result?.error) {
      toast({ title: "Upgrade Error", description: result.error, variant: "destructive" });
    } else if (result?.stripeError) {
      toast({ title: "Payment Error", description: result.stripeError.message, variant: "destructive" });
    }
    setIsUpgrading(false);
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


  const onFormSubmit = async (data: EditCoachProfileFormData) => {
    setUiIsSubmitting(true);
    const submitData: EditProfileFormSubmitData = {
      ...data,
      specialties: data.selectedSpecialties,
      keywords: commaStringToArray(data.keywords),
      certifications: commaStringToArray(data.certifications),
      linkedInUrl: isPremiumCoach ? (data.linkedInUrl?.trim() || undefined) : undefined,
      websiteUrl: isPremiumCoach ? (data.websiteUrl?.trim() || undefined) : undefined,
      introVideoUrl: isPremiumCoach ? (data.introVideoUrl?.trim() || undefined) : undefined,
      availability: data.availability,
      selectedFile: isPremiumCoach && imageAction === 'replace' ? selectedFile : null,
      imageAction: isPremiumCoach ? imageAction : 'keep',
      currentProfileImageUrl: initialData.profileImageUrl || null,
    };
    if (!isPremiumCoach) {
        submitData.imageAction = 'keep';
        submitData.selectedFile = null;
    }

    try {
      await onSubmit(pruneUndefined(submitData));
      toast({ title: 'Success', description: 'Profile update request submitted!' });
      if (isPremiumCoach) {
        setImageAction('keep');
        setSelectedFile(null);
        setImagePreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Error submitting profile update:", error);
      toast({ title: 'Error', description: 'Failed to update profile. Please try again.', variant: 'destructive' });
    } finally {
      setUiIsSubmitting(false);
    }
  };

  let displayImageUrl: string | null = null;
  if (imageAction === 'replace' && imagePreviewUrl) displayImageUrl = imagePreviewUrl;
  else if (imageAction === 'keep' && initialData.profileImageUrl) displayImageUrl = initialData.profileImageUrl;
  else if (imageAction === 'remove') displayImageUrl = null;
  else if (initialData.profileImageUrl) displayImageUrl = initialData.profileImageUrl;

  const totalIsSubmitting = rhfIsSubmitting || uiIsSubmitting || isUpgrading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Your Profile</CardTitle>
        <CardDescription>Update your professional information. Click save when you're done.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label className="flex items-center">
              Profile Picture {isPremiumCoach && <Sparkles className="ml-1 h-4 w-4 text-yellow-500" />}
            </Label>
            <div className="flex items-center gap-4">
              {displayImageUrl ? (
                <NextImage src={displayImageUrl} alt="Profile" width={100} height={100} className="rounded-full object-cover aspect-square" />
              ) : (
                <div className="w-[100px] h-[100px] bg-muted rounded-full flex items-center justify-center">
                  <ImageIcon className="w-10 h-10 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={totalIsSubmitting || !isPremiumCoach}>
                  <UploadCloud className="mr-2 h-4 w-4" /> {initialData.profileImageUrl || imagePreviewUrl ? 'Change Image' : 'Upload Image'}
                </Button>
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageFileChange} disabled={totalIsSubmitting || !isPremiumCoach} />
                { (displayImageUrl || imageAction === 'replace') && imageAction !== 'remove' && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemoveImage} className="text-destructive hover:text-destructive-foreground/90" disabled={totalIsSubmitting || !isPremiumCoach}>
                    <Trash2 className="mr-2 h-4 w-4" /> Remove Image
                  </Button>
                )}
                { imageAction === 'remove' && isPremiumCoach && (
                     <Button type="button" variant="ghost" size="sm" onClick={handleUndoImageAction} disabled={totalIsSubmitting}>Undo Remove</Button>
                )}
              </div>
            </div>
            {!isPremiumCoach && <PremiumFeatureMessage featureName="Profile picture management" onUpgradeClick={handleUpgradeClick} isUpgrading={isUpgrading} />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Controller name="name" control={control} render={({ field }) => <Input {...field} placeholder="Your full name" />} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Controller name="location" control={control} render={({ field }) => <Input {...field} value={field.value ?? ''} placeholder="City, Country" />} />
                {errors.location && <p className="text-sm text-destructive">{errors.location.message}</p>}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="linkedInUrl" className="flex items-center">
                  LinkedIn Profile URL {isPremiumCoach && <Sparkles className="ml-1 h-4 w-4 text-yellow-500" />}
                </Label>
                <Controller name="linkedInUrl" control={control} render={({ field }) => <Input {...field} type="url" value={field.value ?? ''} placeholder="https://linkedin.com/in/yourprofile" disabled={!isPremiumCoach || totalIsSubmitting} />} />
                {errors.linkedInUrl && <p className="text-sm text-destructive">{errors.linkedInUrl.message}</p>}
                {!isPremiumCoach && <PremiumFeatureMessage featureName="LinkedIn URL" onUpgradeClick={handleUpgradeClick} isUpgrading={isUpgrading} />}
              </div>
              <div>
                <Label htmlFor="websiteUrl" className="flex items-center">
                  Website URL {isPremiumCoach && <Sparkles className="ml-1 h-4 w-4 text-yellow-500" />}
                </Label>
                <Controller name="websiteUrl" control={control} render={({ field }) => <Input {...field} type="url" value={field.value ?? ''} placeholder="https://yourwebsite.com" disabled={!isPremiumCoach || totalIsSubmitting} />} />
                {errors.websiteUrl && <p className="text-sm text-destructive">{errors.websiteUrl.message}</p>}
                {!isPremiumCoach && <PremiumFeatureMessage featureName="Website URL" onUpgradeClick={handleUpgradeClick} isUpgrading={isUpgrading} />}
              </div>
              <div>
                <Label htmlFor="introVideoUrl" className="flex items-center">
                  Intro Video URL {isPremiumCoach && <Sparkles className="ml-1 h-4 w-4 text-yellow-500" />}
                </Label>
                <Controller name="introVideoUrl" control={control} render={({ field }) => <Input {...field} type="url" value={field.value ?? ''} placeholder="https://youtube.com/watch?v=yourvideo" disabled={!isPremiumCoach || totalIsSubmitting} />} />
                {errors.introVideoUrl && <p className="text-sm text-destructive">{errors.introVideoUrl.message}</p>}
                {!isPremiumCoach && <PremiumFeatureMessage featureName="Intro Video URL" onUpgradeClick={handleUpgradeClick} isUpgrading={isUpgrading} />}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Controller name="bio" control={control} render={({ field }) => <Textarea {...field} placeholder="Share your coaching philosophy... (Min 50 characters for AI suggestions)" rows={6} />} />
              {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
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

            <div>
              <Label htmlFor="keywords">Keywords (comma-separated)</Label>
              <Controller name="keywords" control={control} render={({ field }) => <Input {...field} placeholder="e.g., Entrepreneurship, Executive Coaching" />} />
              {errors.keywords && <p className="text-sm text-destructive">{errors.keywords.message}</p>}
            </div>
            <div>
              <Label htmlFor="certifications">Certifications & Qualifications (comma-separated)</Label>
              <Controller name="certifications" control={control} render={({ field }) => <Input {...field} placeholder="e.g., ICF Certified, PhD" />} />
              {errors.certifications && <p className="text-sm text-destructive">{errors.certifications.message}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <Label>Availability Slots</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2 p-2 border rounded-md">
                <div className="flex-grow grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor={`availability.${index}.day`} className="sr-only">Day</Label>
                    <Controller name={`availability.${index}.day`} control={control} render={({ field: dayField }) => <Input {...dayField} placeholder="Day (e.g., Monday)" />} />
                    {errors.availability?.[index]?.day && <p className="text-sm text-destructive">{errors.availability[index]?.day?.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor={`availability.${index}.time`} className="sr-only">Time</Label>
                    <Controller name={`availability.${index}.time`} control={control} render={({ field: timeField }) => <Input {...timeField} placeholder="Time (e.g., 9am-5pm EST)" />} />
                    {errors.availability?.[index]?.time && <p className="text-sm text-destructive">{errors.availability[index]?.time?.message}</p>}
                  </div>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={totalIsSubmitting}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <div className="flex items-end gap-2 mt-2 p-2 border border-dashed rounded-md">
              <div className="flex-grow grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="newAvailabilityDay" className="sr-only">New Day</Label>
                  <Input id="newAvailabilityDay" placeholder="New Day" value={newAvailabilityDay} onChange={(e) => setNewAvailabilityDay(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="newAvailabilityTime" className="sr-only">New Time</Label>
                  <Input id="newAvailabilityTime" placeholder="New Time Slot" value={newAvailabilityTime} onChange={(e) => setNewAvailabilityTime(e.target.value)} />
                </div>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={handleAddAvailabilitySlot} disabled={totalIsSubmitting}>
                <PlusCircle className="h-4 w-4" />
              </Button>
            </div>
            {errors.availability?.root && <p className="text-sm text-destructive">{errors.availability.root.message}</p>}
            {Array.isArray(errors.availability) && errors.availability.length > 0 && !errors.availability.root && <p className="text-sm text-destructive">Please check your availability slots for errors.</p>}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={totalIsSubmitting}>
            {totalIsSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
