'use client';

import { useState, useEffect } from 'react';
import type { UserProfile, SocialLink } from '@/types'; // Assuming UserProfile and SocialLink are defined in types
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast'; // Assuming useToast hook is available
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface EditCoachProfileFormProps {
  initialData: Partial<UserProfile>; // Use Partial if not all UserProfile fields are editable here
  onSubmit: (formData: Partial<UserProfile>) => Promise<void>;
  isPremiumCoach: boolean;
}

// Helper to convert array to comma-separated string
const arrayToCommaString = (arr?: string[]): string => arr?.join(', ') || '';

// Helper to convert comma-separated string to array
const commaStringToArray = (str: string): string[] =>
  str.split(',').map(item => item.trim()).filter(item => item !== '');

export const EditCoachProfileForm: React.FC<EditCoachProfileFormProps> = ({ initialData, onSubmit, isPremiumCoach }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: initialData.name || '',
    profileImageUrl: initialData.profileImageUrl || '',
    bio: initialData.bio || '',
    specialties: arrayToCommaString(initialData.specialties),
    keywords: arrayToCommaString(initialData.keywords),
    certifications: arrayToCommaString(initialData.certifications),
    location: initialData.location || '',
    websiteUrl: initialData.websiteUrl || '',
    introVideoUrl: initialData.introVideoUrl || '',
    linkedInUrl: initialData.socialLinks?.find(link => link.platform === 'LinkedIn')?.url || '',
    availabilityText: (initialData as any).availabilityText || '', // Assuming availabilityText is a new field
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Pre-fill form if initialData changes after mount (e.g., fetched async by parent)
    setFormData({
      name: initialData.name || '',
      profileImageUrl: initialData.profileImageUrl || '',
      bio: initialData.bio || '',
      specialties: arrayToCommaString(initialData.specialties),
      keywords: arrayToCommaString(initialData.keywords),
      certifications: arrayToCommaString(initialData.certifications),
      location: initialData.location || '',
      websiteUrl: initialData.websiteUrl || '',
      introVideoUrl: initialData.introVideoUrl || '',
      linkedInUrl: initialData.socialLinks?.find(link => link.platform === 'LinkedIn')?.url || '',
      availabilityText: (initialData as any).availabilityText || '',
    });
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const updatedProfileData: Partial<UserProfile> = {
      name: formData.name.trim(),
      profileImageUrl: formData.profileImageUrl.trim() || null,
      bio: formData.bio.trim(),
      specialties: commaStringToArray(formData.specialties),
      keywords: commaStringToArray(formData.keywords),
      certifications: commaStringToArray(formData.certifications),
      location: formData.location.trim() || null,
      // Premium fields
      ...(isPremiumCoach && {
        websiteUrl: formData.websiteUrl.trim() || null,
        introVideoUrl: formData.introVideoUrl.trim() || null,
      }),
      // Handle LinkedIn URL update within socialLinks array
      socialLinks: initialData.socialLinks // Start with existing social links
        ? initialData.socialLinks
            .filter(link => link.platform !== 'LinkedIn') // Remove old LinkedIn link
            .concat(formData.linkedInUrl.trim() ? [{ platform: 'LinkedIn', url: formData.linkedInUrl.trim() }] : []) // Add new one if present
        : (formData.linkedInUrl.trim() ? [{ platform: 'LinkedIn', url: formData.linkedInUrl.trim() }] : []), // Or create new array
      availabilityText: formData.availabilityText.trim(), // New field
    };

    // Remove empty LinkedIn entry if URL is empty and it was the only one
    if (updatedProfileData.socialLinks?.length === 1 && updatedProfileData.socialLinks[0].platform === 'LinkedIn' && !updatedProfileData.socialLinks[0].url) {
        updatedProfileData.socialLinks = [];
    }


    try {
      await onSubmit(updatedProfileData);
      toast({ title: 'Success', description: 'Profile updated successfully!' });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({ title: 'Error', description: 'Failed to update profile. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Your Profile</CardTitle>
        <CardDescription>Update your professional information. Click save when you're done.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1 */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} placeholder="Your full name" required />
              </div>
              <div>
                <Label htmlFor="profileImageUrl">Profile Picture URL</Label>
                <Input id="profileImageUrl" name="profileImageUrl" type="url" value={formData.profileImageUrl} onChange={handleChange} placeholder="https://example.com/image.png" />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" value={formData.location} onChange={handleChange} placeholder="City, Country" />
              </div>
            </div>
            {/* Column 2 */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="linkedInUrl">LinkedIn Profile URL</Label>
                <Input id="linkedInUrl" name="linkedInUrl" type="url" value={formData.linkedInUrl} onChange={handleChange} placeholder="https://linkedin.com/in/yourprofile" />
              </div>
              {isPremiumCoach && (
                <>
                  <div>
                    <Label htmlFor="websiteUrl">Website URL (Premium)</Label>
                    <Input id="websiteUrl" name="websiteUrl" type="url" value={formData.websiteUrl} onChange={handleChange} placeholder="https://yourwebsite.com" />
                  </div>
                  <div>
                    <Label htmlFor="introVideoUrl">Intro Video URL (Premium)</Label>
                    <Input id="introVideoUrl" name="introVideoUrl" type="url" value={formData.introVideoUrl} onChange={handleChange} placeholder="https://youtube.com/watch?v=yourvideo" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Full-width fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" name="bio" value={formData.bio} onChange={handleChange} placeholder="Tell us about yourself, your experience, and your coaching philosophy." rows={6} />
            </div>
            <div>
              <Label htmlFor="specialties">Specialties (comma-separated)</Label>
              <Input id="specialties" name="specialties" value={formData.specialties} onChange={handleChange} placeholder="e.g., Leadership, Career Growth, Mindfulness" />
            </div>
            <div>
              <Label htmlFor="keywords">Keywords (comma-separated)</Label>
              <Input id="keywords" name="keywords" value={formData.keywords} onChange={handleChange} placeholder="e.g., Entrepreneurship, Executive Coaching, Personal Development" />
            </div>
            <div>
              <Label htmlFor="certifications">Certifications & Qualifications (comma-separated)</Label>
              <Input id="certifications" name="certifications" value={formData.certifications} onChange={handleChange} placeholder="e.g., ICF Certified, PhD in Psychology" />
            </div>
            <div>
              <Label htmlFor="availabilityText">Availability Description</Label>
              <Textarea id="availabilityText" name="availabilityText" value={formData.availabilityText} onChange={handleChange} placeholder="Describe your general availability (e.g., Weekday afternoons, Flexible on weekends)" rows={3} />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
