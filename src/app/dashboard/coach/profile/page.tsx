
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
import { Loader2, UserCircle, Lightbulb, Save, UploadCloud, Link as LinkIcon, Crown, Globe, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { suggestCoachSpecialties, type SuggestCoachSpecialtiesInput, type SuggestCoachSpecialtiesOutput } from '@/ai/flows/suggest-coach-specialties';
import { allSpecialties as predefinedSpecialties, mockCoaches } from '@/data/mock';
import type { Coach } from '@/types';
import { debounce } from 'lodash';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth';
import { uploadProfileImage } from '@/services/imageUpload';

const coachProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.').optional(),
  bio: z.string().min(50, 'Bio must be at least 50 characters.'),
  selectedSpecialties: z.array(z.string()).min(1, 'Please select at least one specialty.'),
  customSpecialty: z.string().optional(),
  profileImageUrl: z.string().url('Profile image URL must be a valid URL.').optional().or(z.literal('')),
  certifications: z.string().optional(),
  location: z.string().optional(),
  // Premium fields
  websiteUrl: z.string().url('Invalid URL for website.').optional().or(z.literal('')),
  introVideoUrl: z.string().url('Invalid URL for intro video.').optional().or(z.literal('')),
  socialLinkPlatform: z.string().optional(),
  socialLinkUrl: z.string().url('Invalid URL for social link.').optional().or(z.literal('')),
});

type CoachProfileFormData = z.infer<typeof coachProfileSchema>;

export default function CoachProfilePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [suggestedSpecialtiesState, setSuggestedSpecialtiesState] = useState<string[]>([]);
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [availableSpecialties, setAvailableSpecialties] = useState<string[]>(predefinedSpecialties);
  const [currentCoach, setCurrentCoach] = useState<Coach | null>(null);
  const { user, loading: authLoading } = useAuth();

  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<File | null>(null);


  const { toast } = useToast();
  const { control, register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<CoachProfileFormData>({
    resolver: zodResolver(coachProfileSchema),
    defaultValues: {
      selectedSpecialties: [],
      profileImageUrl: '',
    }
  });

  const bioValue = watch('bio');
  const currentProfileImageUrl = watch('profileImageUrl'); // This will hold the URL from DB or the newly uploaded one

  useEffect(() => {
    if (authLoading) return;
    // Simulating fetching current coach data. In a real app, fetch by user.id
    const coachData = mockCoaches.find(c => c.id === (user?.id || '1')); // Fallback to '1' for mock if no user
    if (coachData) {
      setCurrentCoach(coachData);
      reset({
        name: coachData.name,
        email: coachData.email || `${user?.email}`,
        bio: coachData.bio,
        selectedSpecialties: coachData.specialties,
        profileImageUrl: coachData.profileImageUrl || '',
        certifications: coachData.certifications?.join(', '),
        location: coachData.location,
        websiteUrl: coachData.websiteUrl,
        introVideoUrl: coachData.introVideoUrl,
        socialLinkPlatform: coachData.socialLinks?.[0]?.platform,
        socialLinkUrl: coachData.socialLinks?.[0]?.url,
      });
      const allSpecs = new Set([...predefinedSpecialties, ...coachData.specialties]);
      setAvailableSpecialties(Array.from(allSpecs));
    } else if (user) {
      // Initialize with some basic data if coach not found in mock for current user
      setCurrentCoach({
        id: user.id,
        name: user.name || '',
        email: user.email,
        bio: '',
        specialties: [],
        keywords: [],
        subscriptionTier: 'free', // default
      });
       reset({
        name: user.name || '',
        email: user.email,
        bio: '',
        selectedSpecialties: [],
        profileImageUrl: '',
      });
    }
  }, [reset, user, authLoading]);

  const fetchSuggestions = useCallback(
    debounce(async (bioText: string) => {
      if (bioText && bioText.length >= 50) {
        setIsAiLoading(true);
        try {
          const input: SuggestCoachSpecialtiesInput = { bio: bioText };
          await new Promise(resolve => setTimeout(resolve, 1000));
          const simulatedResponse: SuggestCoachSpecialtiesOutput = {
             specialties: predefinedSpecialties.filter(s => bioText.toLowerCase().includes(s.split(" ")[0].toLowerCase())).slice(0,3),
             keywords: ['updated keyword1', 'updated keyword2']
          };
          setSuggestedSpecialtiesState(simulatedResponse.specialties);
          setSuggestedKeywords(simulatedResponse.keywords);
        } catch (error) {
          console.error('Error fetching AI suggestions:', error);
          toast({ title: "AI Suggestion Error", description: "Could not fetch suggestions.", variant: "destructive" });
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
    if (!user || !currentCoach) {
        toast({ title: "Error", description: "User not authenticated or coach data missing.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    let finalProfileImageUrl = data.profileImageUrl;

    if (selectedFileForUpload) {
        try {
            finalProfileImageUrl = await uploadProfileImage(selectedFileForUpload, user.id, currentCoach.profileImageUrl);
            setValue('profileImageUrl', finalProfileImageUrl); // Update form value with new URL
            setImagePreviewUrl(null); // Clear preview as it's now uploaded
            setSelectedFileForUpload(null); // Clear selected file
        } catch (uploadError: any) {
            toast({ title: "Image Upload Failed", description: uploadError.message, variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
    }
    
    const updatedProfileData = { ...data, profileImageUrl: finalProfileImageUrl };
    console.log('Updating coach profile data:', updatedProfileData);
    // Simulate API call to save profile data
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Update mockCoaches (or would save to DB)
    const coachIndex = mockCoaches.findIndex(c => c.id === currentCoach.id);
    if (coachIndex !== -1) {
      mockCoaches[coachIndex] = {
        ...mockCoaches[coachIndex],
        ...updatedProfileData,
        specialties: updatedProfileData.selectedSpecialties,
        certifications: updatedProfileData.certifications?.split(',').map(c => c.trim()).filter(Boolean) || [],
        socialLinks: updatedProfileData.socialLinkPlatform && updatedProfileData.socialLinkUrl ? [{platform: updatedProfileData.socialLinkPlatform, url: updatedProfileData.socialLinkUrl}] : [],
      };
    }


    setIsSubmitting(false);
    toast({
      title: "Profile Updated!",
      description: "Your profile changes have been saved successfully.",
      action: <Save className="text-green-500" />,
    });
  };

  const handleAddCustomSpecialty = () => {
    const customSpecialty = control._formValues.customSpecialty?.trim();
    if (customSpecialty && !availableSpecialties.includes(customSpecialty)) {
      setAvailableSpecialties(prev => [...prev, customSpecialty]);
      setValue('selectedSpecialties', [...(control._formValues.selectedSpecialties || []), customSpecialty]);
      setValue('customSpecialty', '');
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFileForUpload(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedFileForUpload(null);
      setImagePreviewUrl(null);
    }
  };

  if (authLoading || !currentCoach && !user) { // Show loading if auth is pending or if no user and no coach data yet
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Loading profile...</div>;
  }
  if (!user && !authLoading) { // If auth is done and still no user, prompt login
      router.push('/login'); // Or show a message
      return <div className="flex justify-center items-center h-full">Please log in to view your profile.</div>;
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
              <Badge variant={isPremium ? "default" : "secondary"} className={isPremium ? "bg-yellow-500 text-white" : ""}>
                  <Crown className="mr-2 h-4 w-4" /> {currentCoach.subscriptionTier.toUpperCase()} Tier
              </Badge>
            )}
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Basic Info */}
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
              <div className="space-y-1">
                <Label htmlFor="bio">Your Bio (min. 50 characters)</Label>
                <Textarea id="bio" {...register('bio')} rows={6} className={errors.bio ? 'border-destructive' : ''} />
                {errors.bio && <p className="text-sm text-destructive">{errors.bio.message}</p>}
              </div>
            </div>
          </section>

          { (isAiLoading || suggestedKeywords.length > 0 || suggestedSpecialtiesState.length > 0) && (
            <Alert variant="default" className="bg-accent/20">
              <Lightbulb className="h-5 w-5 text-primary" />
              <AlertTitle className="font-semibold">AI Suggestions Based on Your Bio</AlertTitle>
              <AlertDescription className="space-y-1">
                {isAiLoading && <p className="text-sm flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Analyzing bio...</p>}
                {suggestedKeywords.length > 0 && <p className="text-sm">Suggested Keywords: {suggestedKeywords.join(', ')}</p>}
                {suggestedSpecialtiesState.length > 0 && <p className="text-sm">Consider adding these specialties: {suggestedSpecialtiesState.join(', ')}</p>}
              </AlertDescription>
            </Alert>
          )}
          {/* Specialties and Location */}
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
                        {availableSpecialties.map((specialty) => (
                            <div key={specialty} className="flex items-center space-x-2">
                            <Checkbox
                                id={`specialty-${specialty}`}
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
                            <Label htmlFor={`specialty-${specialty}`} className="font-normal">{specialty}</Label>
                            </div>
                        ))}
                        </div>
                    )}
                    />
                    {errors.selectedSpecialties && <p className="text-sm text-destructive">{errors.selectedSpecialties.message}</p>}
                    <div className="flex items-center gap-2 mt-2">
                    <Input {...register('customSpecialty')} placeholder="Add custom specialty" className="flex-grow"/>
                    <Button type="button" variant="outline" onClick={handleAddCustomSpecialty}>Add</Button>
                    </div>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="location">Location (Optional)</Label>
                    <Input id="location" {...register('location')} placeholder="e.g., New York, NY or Remote" />
                </div>
                
                <div className="space-y-1">
                    <Label htmlFor="profileImageFile">Profile Image</Label>
                    <div className="flex items-center gap-2">
                        <UploadCloud className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        <Input 
                            id="profileImageFile" 
                            type="file" 
                            accept="image/png, image/jpeg, image/gif, image/webp"
                            onChange={handleImageUpload}
                            className="flex-grow"
                        />
                    </div>
                     {(imagePreviewUrl || currentProfileImageUrl) && (
                        <div className="mt-2 relative w-32 h-32">
                            <Image
                                src={imagePreviewUrl || currentProfileImageUrl || "https://placehold.co/128x128.png"}
                                alt="Profile preview"
                                fill
                                className="rounded-md object-cover border"
                                data-ai-hint="profile preview"
                            />
                        </div>
                    )}
                    {errors.profileImageUrl && <p className="text-sm text-destructive">{errors.profileImageUrl.message}</p>}
                     <p className="text-xs text-muted-foreground">
                        Upload an image. For best results, use a square image.
                    </p>
                </div>

                <div className="space-y-1">
                    <Label htmlFor="certifications">Certifications (Optional, comma-separated)</Label>
                    <Input id="certifications" {...register('certifications')} />
                </div>
            </div>
          </section>

          {/* Premium Features Section */}
          <section>
            <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-lg font-semibold">Premium Features</h3>
                {!isPremium && (
                    <Button variant="outline" size="sm" asChild className="border-yellow-500 text-yellow-600 hover:bg-yellow-50">
                        <Link href="/pricing"><Crown className="mr-2 h-4 w-4" /> Upgrade to Premium</Link>
                    </Button>
                )}
            </div>
            <div className="space-y-4">
                <div className="space-y-1">
                    <Label htmlFor="websiteUrl" className={!isPremium ? "text-muted-foreground" : ""}>Website URL</Label>
                     <div className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-muted-foreground" />
                        <Input id="websiteUrl" {...register('websiteUrl')} className={errors.websiteUrl ? 'border-destructive' : ''} disabled={!isPremium} />
                    </div>
                    {errors.websiteUrl && <p className="text-sm text-destructive">{errors.websiteUrl.message}</p>}
                     {!isPremium && <p className="text-xs text-muted-foreground">Available for Premium coaches.</p>}
                </div>
                 <div className="space-y-1">
                    <Label htmlFor="introVideoUrl" className={!isPremium ? "text-muted-foreground" : ""}>Intro Video URL (e.g., YouTube)</Label>
                    <div className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-muted-foreground" />
                        <Input id="introVideoUrl" {...register('introVideoUrl')} className={errors.introVideoUrl ? 'border-destructive' : ''} disabled={!isPremium} />
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
                        <Input id="socialLinkUrl" {...register('socialLinkUrl')} className={errors.socialLinkUrl ? 'border-destructive' : ''} disabled={!isPremium} />
                    </div>
                    {errors.socialLinkUrl && <p className="text-sm text-destructive">{errors.socialLinkUrl.message}</p>}
                    </div>
                </div>
                 {!isPremium && <p className="text-xs text-muted-foreground">Social media links are available for Premium coaches.</p>}
            </div>
          </section>
          
          <Button type="submit" disabled={isSubmitting || isAiLoading} size="lg" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Saving Changes...
              </>
            ) : (
              <><Save className="mr-2 h-5 w-5" /> Save Changes</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
