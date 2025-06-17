'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/types'; // UserProfile from types/index.ts uses 'id'
import CoachProfile from '@/components/CoachProfile';
import { Skeleton } from '@/components/ui/skeleton';

const CoachProfilePage = () => {
  const { user, loading: authLoading } = useAuth(); // user object from useAuth has 'id'
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  console.log('[CoachProfilePage] Rendering. Initial authLoading:', authLoading, 'Initial user from useAuth():', user);

  useEffect(() => {
    console.log('[CoachProfilePage] useEffect triggered. Current user from useAuth():', user, 'AuthLoading:', authLoading);

    // Changed user.uid to user.id
    if (user && user.id) {
      console.log('[CoachProfilePage] useEffect: User and user.id exist. ID:', user.id, '. Attempting to set up Firestore listener.');
      setProfileLoading(true);
      const docRef = doc(db, 'users', user.id); // Use user.id
      const unsubscribe = onSnapshot(docRef, (doc) => {
        console.log('[CoachProfilePage] onSnapshot callback triggered. Doc received. Doc exists?', doc.exists());
        if (doc.exists()) {
          const data = doc.data() as UserProfile;
          console.log('[CoachProfilePage] onSnapshot: Document exists. Data:', data);
          // UserProfile type uses 'id', so this aligns.
          setUserProfile({ ...data, id: doc.id });
        } else {
          console.log('[CoachProfilePage] onSnapshot: No profile document found for user ID:', user.id);
          setUserProfile(null);
        }
        setProfileLoading(false);
      }, (error) => {
        console.error('[CoachProfilePage] onSnapshot: Error listening to user profile updates for ID:', user.id, error);
        setUserProfile(null);
        setProfileLoading(false);
      });
      
      return () => {
        console.log('[CoachProfilePage] useEffect cleanup. Unsubscribing from Firestore listener for ID:', user.id);
        unsubscribe();
      };
    } else {
      console.log('[CoachProfilePage] useEffect: User or user.id is missing or auth still loading. User:', user, 'AuthLoading:', authLoading);
      if (!authLoading && !user) {
        setProfileLoading(false);
      }
    }
  }, [user, authLoading]);

  if (authLoading) {
    console.log('[CoachProfilePage] Render: authLoading is true. Displaying main skeleton.');
    return (
        <div className="p-4 md:p-8">
            <h1 className="text-2xl font-bold mb-4">Your Profile</h1>
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
    console.log('[CoachProfilePage] Render: No user from useAuth(). Displaying "User profile not found. Please log in."');
    return <div className="p-4">User profile not found. Please log in.</div>;
  }
  
  if (profileLoading) {
    console.log('[CoachProfilePage] Render: User exists, but profileLoading is true. Displaying profile skeleton.');
      return (
        <div className="p-4 md:p-8">
            <h1 className="text-2xl font-bold mb-4">Your Profile</h1>
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
    console.log('[CoachProfilePage] Render: userProfile is null. Displaying "Your user profile could not be loaded."');
    return <div className="p-4">Your user profile could not be loaded. Please contact support. (Hint: Check console for Firestore errors or 'No document' messages for your user ID).</div>;
  }

  console.log('[CoachProfilePage] Render: Rendering CoachProfile with userProfile:', userProfile);
  // Changed userProfile.uid to userProfile.id for coachId prop
  return <CoachProfile coachData={userProfile} coachId={userProfile.id} />;
};

export default CoachProfilePage;
