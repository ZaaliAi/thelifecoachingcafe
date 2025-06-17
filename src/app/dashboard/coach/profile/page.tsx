'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile, SocialLink } from '@/types'; // Added SocialLink
import { EditCoachProfileForm, type EditProfileFormSubmitData } from '@/components/dashboard/EditCoachProfileForm'; // Import form and its submit data type
import { updateUserProfile } from '@/lib/firestore';
import { uploadProfileImage } from '@/services/imageUpload'; // Import image upload service
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const CoachProfilePage = () => {
  const { user, loading: authLoading } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (user && user.id) {
      setProfileLoading(true);
      const docRef = doc(db, 'users', user.id);
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile({ ...docSnap.data() as UserProfile, id: docSnap.id });
        } else {
          setUserProfile(null);
        }
        setProfileLoading(false);
      }, (error) => {
        console.error('[CoachProfilePage] onSnapshot: Error listening to user profile updates for ID:', user.id, error);
        setUserProfile(null);
        setProfileLoading(false);
      });
      return () => unsubscribe();
    } else {
      if (!authLoading && !user) {
        setProfileLoading(false);
      }
    }
  }, [user, authLoading]);

  const handleProfileUpdate = useCallback(async (submitData: EditProfileFormSubmitData) => {
    if (!user || !user.id || !userProfile) { // userProfile must exist to get currentProfileImageUrl if needed
      toast({ title: 'Error', description: 'User session or profile data is missing. Please try again.', variant: 'destructive' });
      throw new Error('User not authenticated or profile not loaded');
    }

    let profileImageUrlToSave: string | null = submitData.currentProfileImageUrl || null;

    try {
      if (submitData.imageAction === 'replace' && submitData.selectedFile) {
        toast({ title: 'Uploading image...', description: 'Please wait.' });
        profileImageUrlToSave = await uploadProfileImage(submitData.selectedFile, user.id, submitData.currentProfileImageUrl);
      } else if (submitData.imageAction === 'remove') {
        if (submitData.currentProfileImageUrl) { // Only attempt delete if there was an image
          toast({ title: 'Removing image...', description: 'Please wait.' });
          await uploadProfileImage(undefined, user.id, submitData.currentProfileImageUrl);
        }
        profileImageUrlToSave = null;
      }
      // If imageAction is 'keep', profileImageUrlToSave remains submitData.currentProfileImageUrl

      // Reconstruct socialLinks
      let updatedSocialLinks: SocialLink[] = userProfile.socialLinks?.filter(link => link.platform !== 'LinkedIn') || [];
      if (submitData.linkedInUrl && submitData.linkedInUrl.trim() !== '') {
        updatedSocialLinks.push({ platform: 'LinkedIn', url: submitData.linkedInUrl.trim() });
      }
      // Ensure empty array if no links, not array with empty object
      if (updatedSocialLinks.length === 1 && updatedSocialLinks[0].platform === 'LinkedIn' && !updatedSocialLinks[0].url) {
          updatedSocialLinks = [];
      }


      const { selectedFile, imageAction, currentProfileImageUrl, linkedInUrl, ...otherFormData } = submitData;

      const dataForFirestore: Partial<UserProfile> = {
        ...otherFormData, // name, bio, specialties (as array), availability (as array), etc.
        profileImageUrl: profileImageUrlToSave,
        socialLinks: updatedSocialLinks,
      };

      await updateUserProfile(user.id, dataForFirestore);
      // Toast for success is now in EditCoachProfileForm, triggered after this onSubmit resolves
      // However, we might want a specific one here if upload was involved.
      // For now, relying on the form's toast.
      // The onSnapshot listener will update userProfile, refreshing initialData for the form.
    } catch (error: any) {
      console.error("Error in handleProfileUpdate:", error);
      toast({ title: 'Update Failed', description: error.message || 'Could not update profile.', variant: 'destructive' });
      throw error; // Re-throw to let the form know submission failed
    }
  }, [user, userProfile, toast]);


  if (authLoading) {
    return ( /* Skeleton for auth loading */
        <div className="p-4 md:p-8">
            <h1 className="text-2xl font-bold mb-4">Edit Your Profile</h1>
            <div className="space-y-4"> <Skeleton className="h-8 w-1/4" /> <Skeleton className="h-40 w-full" /> </div>
        </div>
    );
  }

  if (!user) {
    return <div className="p-4">User profile not found. Please log in.</div>;
  }
  
  if (profileLoading) {
    return ( /* Skeleton for profile data loading */
        <div className="p-4 md:p-8">
            <h1 className="text-2xl font-bold mb-4">Edit Your Profile</h1>
            <div className="space-y-4"> <Skeleton className="h-8 w-1/4" /> <Skeleton className="h-40 w-full" /> </div>
        </div>
    );
  }

  if (!userProfile) {
    return <div className="p-4">Your user profile data could not be loaded to edit. Please contact support.</div>;
  }

  return (
    <div className="p-4 md:p-8">
      <EditCoachProfileForm
        initialData={userProfile}
        onSubmit={handleProfileUpdate}
        isPremiumCoach={userProfile.subscriptionTier === 'premium'}
      />
    </div>
  );
};

export default CoachProfilePage;
