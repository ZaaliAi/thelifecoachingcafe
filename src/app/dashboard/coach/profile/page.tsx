'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth'; // User type from here should have id, role, subscriptionTier
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { UserProfile } from '@/types';
import { EditCoachProfileForm } from '@/components/dashboard/EditCoachProfileForm'; // Import the new form
import { updateUserProfile } from '@/lib/firestore'; // Import the update function
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast'; // For feedback on update

const CoachProfilePage = () => {
  const { user, loading: authLoading } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const { toast } = useToast();

  // console.log('[CoachProfilePage] Rendering. Initial authLoading:', authLoading, 'Initial user from useAuth():', user); // Keep for debugging if needed

  useEffect(() => {
    // console.log('[CoachProfilePage] useEffect triggered. Current user from useAuth():', user, 'AuthLoading:', authLoading); // Keep for debugging

    if (user && user.id) {
      // console.log('[CoachProfilePage] useEffect: User and user.id exist. ID:', user.id, '. Attempting to set up Firestore listener.'); // Keep for debugging
      setProfileLoading(true);
      const docRef = doc(db, 'users', user.id);
      const unsubscribe = onSnapshot(docRef, (docSnap) => { // Renamed 'doc' to 'docSnap' to avoid conflict
        // console.log('[CoachProfilePage] onSnapshot callback triggered. Doc received. Doc exists?', docSnap.exists()); // Keep for debugging
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          // console.log('[CoachProfilePage] onSnapshot: Document exists. Data:', data); // Keep for debugging
          setUserProfile({ ...data, id: docSnap.id });
        } else {
          // console.log('[CoachProfilePage] onSnapshot: No profile document found for user ID:', user.id); // Keep for debugging
          setUserProfile(null);
        }
        setProfileLoading(false);
      }, (error) => {
        // console.error('[CoachProfilePage] onSnapshot: Error listening to user profile updates for ID:', user.id, error); // Keep for debugging
        setUserProfile(null);
        setProfileLoading(false);
      });
      
      return () => {
        // console.log('[CoachProfilePage] useEffect cleanup. Unsubscribing from Firestore listener for ID:', user.id); // Keep for debugging
        unsubscribe();
      };
    } else {
      // console.log('[CoachProfilePage] useEffect: User or user.id is missing or auth still loading. User:', user, 'AuthLoading:', authLoading); // Keep for debugging
      if (!authLoading && !user) {
        setProfileLoading(false);
      }
    }
  }, [user, authLoading]);

  const handleProfileUpdate = useCallback(async (formData: Partial<UserProfile>) => {
    if (!user || !user.id) {
      toast({ title: 'Error', description: 'You must be logged in to update your profile.', variant: 'destructive' });
      throw new Error('User not authenticated');
    }
    // The `updateUserProfile` function in firestore.ts will handle adding 'updatedAt'
    await updateUserProfile(user.id, formData);
    // No need to manually set userProfile state here if onSnapshot listener is active,
    // as it will pick up the changes from Firestore and update the local state automatically.
    // If onSnapshot is not desired after an edit, then manual update or refetch would be needed.
    // For now, relying on onSnapshot.
  }, [user, toast]);


  if (authLoading) {
    // console.log('[CoachProfilePage] Render: authLoading is true. Displaying main skeleton.'); // Keep for debugging
    return (
        <div className="p-4 md:p-8">
            <h1 className="text-2xl font-bold mb-4">Edit Your Profile</h1> {/* Title changed */}
            <div className="space-y-4">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-20 w-full" />
            </div>
        </div>
    );
  }

  if (!user) {
    // console.log('[CoachProfilePage] Render: No user from useAuth(). Displaying "User profile not found. Please log in."'); // Keep for debugging
    return <div className="p-4">User profile not found. Please log in.</div>;
  }
  
  if (profileLoading) {
    // console.log('[CoachProfilePage] Render: User exists, but profileLoading is true. Displaying profile skeleton.'); // Keep for debugging
      return (
        <div className="p-4 md:p-8">
            <h1 className="text-2xl font-bold mb-4">Edit Your Profile</h1> {/* Title changed */}
            <div className="space-y-4">
                <Skeleton className="h-8 w-1/4" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-20 w-full" />
            </div>
        </div>
    );
  }

  if (!userProfile) {
    // console.log('[CoachProfilePage] Render: userProfile is null. Displaying "Your user profile could not be loaded."'); // Keep for debugging
    return <div className="p-4">Your user profile data could not be loaded to edit. Please contact support.</div>; // Message slightly changed
  }

  // console.log('[CoachProfilePage] Render: Rendering EditCoachProfileForm with userProfile:', userProfile); // Keep for debugging
  return (
    <div className="p-4 md:p-8">
      {/* The EditCoachProfileForm is already wrapped in a Card, so no need for another Card here unless desired for page layout */}
      <EditCoachProfileForm
        initialData={userProfile}
        onSubmit={handleProfileUpdate}
        isPremiumCoach={userProfile.subscriptionTier === 'premium'}
      />
    </div>
  );
};

export default CoachProfilePage;
