'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Loader2, UploadCloud, Trash2, Image as ImageIcon, PlusCircle } from 'lucide-react';
import NextImage from 'next/image';

// Zod Schema for individual availability slot
const availabilitySlotSchema = z.object({
  day: z.string().min(1, 'Day is required.'),
  time: z.string().min(1, 'Time slot is required.'),
});

// Zod Schema for form validation
const editCoachProfileSchema = z.object({
  name: z.string().min(1, 'Full name is required'),
  bio: z.string().optional(),
  specialties: z.string().optional(),
  keywords: z.string().optional(),
  certifications: z.string().optional(),
  location: z.string().optional().nullable(),
  websiteUrl: z.string().url({ message: "Invalid URL format" }).optional().or(z.literal('')),
  introVideoUrl: z.string().url({ message: "Invalid URL format" }).optional().or(z.literal('')),
  linkedInUrl: z.string().url({ message: "Invalid URL format" }).optional().or(z.literal('')),
  availability: z.array(availabilitySlotSchema).optional().default([]), // Replaced availabilityText
});

type EditCoachProfileFormData = z.infer<typeof editCoachProfileSchema>;

// Data structure passed UP to the parent component
export interface EditProfileFormSubmitData extends Omit<Partial<UserProfile>, 'profileImageUrl' | 'socialLinks' | 'availability' | 'availabilityText'> {
  name: string;
  bio?: string;
  specialties: string[];
  keywords: string[];
  certifications: string[];
  location?: string | null;
  websiteUrl?: string | null;
  introVideoUrl?: string | null;
  linkedInUrl?: string;
  availability?: AvailabilitySlot[]; // Updated
  selectedFile?: File | null;
  imageAction: 'keep' | 'replace' | 'remove';
  currentProfileImageUrl?: string | null;
}

interface EditCoachProfileFormProps {
  initialData: Partial<UserProfile>;
  onSubmit: (formData: EditProfileFormSubmitData) => Promise<void>;
  isPremiumCoach: boolean;
}

const arrayToCommaString = (arr?: string[]): string => arr?.join(', ') || '';
const commaStringToArray = (str?: string): string[] =>
  str ? str.split(',').map(item => item.trim()).filter(item => item !== '') : [];

export const EditCoachProfileForm: React.FC<EditCoachProfileFormProps> = ({ initialData, onSubmit, isPremiumCoach }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { control, handleSubmit, reset, formState: { errors, isSubmitting: rhfIsSubmitting }, getValues } = useForm<EditCoachProfileFormData>({
    resolver: zodResolver(editCoachProfileSchema),
    defaultValues: {
      name: initialData.name || '',
      bio: initialData.bio || '',
      specialties: arrayToCommaString(initialData.specialties),
      keywords: arrayToCommaString(initialData.keywords),
      certifications: arrayToCommaString(initialData.certifications),
      location: initialData.location || '',
      websiteUrl: initialData.websiteUrl || '',
      introVideoUrl: initialData.introVideoUrl || '',
      linkedInUrl: initialData.socialLinks?.find(link => link.platform === 'LinkedIn')?.url || '',
      availability: initialData.availability || [], // Initialize with array
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "availability",
  });

  // State for new availability slot inputs
  const [newAvailabilityDay, setNewAvailabilityDay] = useState('');
  const [newAvailabilityTime, setNewAvailabilityTime] = useState('');

  // Image specific state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageAction, setImageAction] = useState<'keep' | 'replace' | 'remove'>('keep');
  const [uiIsSubmitting, setUiIsSubmitting] = useState(false);

  useEffect(() => {
    reset({
      name: initialData.name || '',
      bio: initialData.bio || '',
      specialties: arrayToCommaString(initialData.specialties),
      keywords: arrayToCommaString(initialData.keywords),
      certifications: arrayToCommaString(initialData.certifications),
      location: initialData.location || '',
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
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      setImageAction('replace');
    }
  };

  const handleRemoveImage = () => {
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

  const onFormSubmit = async (data: EditCoachProfileFormData) => {
    setUiIsSubmitting(true);
    const submitData: EditProfileFormSubmitData = {
      ...data,
      specialties: commaStringToArray(data.specialties),
      keywords: commaStringToArray(data.keywords),
      certifications: commaStringToArray(data.certifications),
      linkedInUrl: data.linkedInUrl?.trim() || undefined,
      websiteUrl: isPremiumCoach ? (data.websiteUrl?.trim() || undefined) : undefined,
      introVideoUrl: isPremiumCoach ? (data.introVideoUrl?.trim() || undefined) : undefined,
      availability: data.availability, // This is now an array of objects from RHF
      selectedFile: imageAction === 'replace' ? selectedFile : null,
      imageAction: imageAction,
      currentProfileImageUrl: initialData.profileImageUrl || null,
    };

    try {
      await onSubmit(submitData);
      toast({ title: 'Success', description: 'Profile update request submitted!' });
      setImageAction('keep');
      setSelectedFile(null);
      setImagePreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  const totalIsSubmitting = rhfIsSubmitting || uiIsSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Your Profile</CardTitle>
        <CardDescription>Update your professional information. Click save when you're done.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <CardContent className="space-y-6">
          {/* Profile Image Section */}
          <div className="space-y-2">
            <Label>Profile Picture</Label>
            {/* ... image display and buttons ... (kept same as previous step) */}
            <div className="flex items-center gap-4">
              {displayImageUrl ? (
                <NextImage src={displayImageUrl} alt="Profile" width={100} height={100} className="rounded-full object-cover aspect-square" />
              ) : (
                <div className="w-[100px] h-[100px] bg-muted rounded-full flex items-center justify-center">
                  <ImageIcon className="w-10 h-10 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={totalIsSubmitting}>
                  <UploadCloud className="mr-2 h-4 w-4" /> {initialData.profileImageUrl || imagePreviewUrl ? 'Change Image' : 'Upload Image'}
                </Button>
                <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageFileChange} disabled={totalIsSubmitting} />
                { (displayImageUrl || imageAction === 'replace') && imageAction !== 'remove' && (
                  <Button type="button" variant="ghost" size="sm" onClick={handleRemoveImage} className="text-destructive hover:text-destructive-foreground/90" disabled={totalIsSubmitting}>
                    <Trash2 className="mr-2 h-4 w-4" /> Remove Image
                  </Button>
                )}
                { imageAction === 'remove' && (
                     <Button type="button" variant="ghost" size="sm" onClick={handleUndoImageAction} disabled={totalIsSubmitting}>Undo Remove</Button>
                )}
              </div>
            </div>
          </div>

          {/* Textual Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ... name, location, linkedIn, premium fields ... (kept same structure) */}
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
                <Label htmlFor="linkedInUrl">LinkedIn Profile URL</Label>
                <Controller name="linkedInUrl" control={control} render={({ field }) => <Input {...field} type="url" value={field.value ?? ''} placeholder="https://linkedin.com/in/yourprofile" />} />
                {errors.linkedInUrl && <p className="text-sm text-destructive">{errors.linkedInUrl.message}</p>}
              </div>
              {isPremiumCoach && (
                <>
                  <div>
                    <Label htmlFor="websiteUrl">Website URL (Premium)</Label>
                    <Controller name="websiteUrl" control={control} render={({ field }) => <Input {...field} type="url" value={field.value ?? ''} placeholder="https://yourwebsite.com" />} />
                    {errors.websiteUrl && <p className="text-sm text-destructive">{errors.websiteUrl.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="introVideoUrl">Intro Video URL (Premium)</Label>
                    <Controller name="introVideoUrl" control={control} render={({ field }) => <Input {...field} type="url" value={field.value ?? ''} placeholder="https://youtube.com/watch?v=yourvideo" />} />
                    {errors.introVideoUrl && <p className="text-sm text-destructive">{errors.introVideoUrl.message}</p>}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Full-width fields: bio, specialties, keywords, certifications */}
          <div className="space-y-4">
            {/* ... bio, specialties, keywords, certifications ... (kept same structure) */}
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Controller name="bio" control={control} render={({ field }) => <Textarea {...field} placeholder="Tell us about yourself..." rows={6} />} />
              {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
            </div>
            <div>
              <Label htmlFor="specialties">Specialties (comma-separated)</Label>
              <Controller name="specialties" control={control} render={({ field }) => <Input {...field} placeholder="e.g., Leadership, Career Growth" />} />
              {errors.specialties && <p className="text-sm text-destructive">{errors.specialties.message}</p>}
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

          {/* Structured Availability Section */}
          <div className="space-y-4">
            <Label>Availability Slots</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2 p-2 border rounded-md">
                <div className="flex-grow grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor={`availability.${index}.day`} className="sr-only">Day</Label>
                    <Controller
                      name={`availability.${index}.day`}
                      control={control}
                      render={({ field: dayField }) => <Input {...dayField} placeholder="Day (e.g., Monday)" />}
                    />
                    {errors.availability?.[index]?.day && <p className="text-sm text-destructive">{errors.availability[index]?.day?.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor={`availability.${index}.time`} className="sr-only">Time</Label>
                    <Controller
                      name={`availability.${index}.time`}
                      control={control}
                      render={({ field: timeField }) => <Input {...timeField} placeholder="Time (e.g., 9am-5pm EST)" />}
                    />
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
                  <Input
                    id="newAvailabilityDay"
                    placeholder="New Day"
                    value={newAvailabilityDay}
                    onChange={(e) => setNewAvailabilityDay(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="newAvailabilityTime" className="sr-only">New Time</Label>
                  <Input
                    id="newAvailabilityTime"
                    placeholder="New Time Slot"
                    value={newAvailabilityTime}
                    onChange={(e) => setNewAvailabilityTime(e.target.value)}
                  />
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
