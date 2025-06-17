
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/types';
import CoachProfile from '@/components/CoachProfile';
import { Skeleton } from '@/components/ui/skeleton';

const CoachProfilePage = () => {
  const { user, loading: authLoading } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    // This effect should only be concerned with fetching data when the user is available.
    if (user && user.uid) {
      setProfileLoading(true); // We are now loading the profile.
      const docRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
          setUserProfile({ ...doc.data() as UserProfile, uid: doc.id });
        } else {
          console.log('No profile document found for user:', user.uid);
          setUserProfile(null);
        }
        setProfileLoading(false); // We are done loading the profile.
      }, (error) => {
        console.error("Error listening to user profile updates:", error);
        setUserProfile(null);
        setProfileLoading(false);
      });
      
      // Cleanup subscription when the user object changes or component unmounts.
      return () => unsubscribe();
    }
  }, [user]); // The effect depends solely on the user object.

  // --- Rendering Logic ---

  // 1. If authentication is in progress, always show the main skeleton.
  if (authLoading) {
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

  // 2. If auth is done and there's no user, they should not be here.
  if (!user) {
      return <div>User profile not found. Please log in.</div>;
  }
  
  // 3. If we have a user, but are waiting for their profile, show the skeleton.
  if (profileLoading) {
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

  // 4. If we have a user, finished loading, but found no profile document.
  if (!userProfile) {
    return <div>Your user profile could not be loaded. Please contact support.</div>;
  }

  // 5. If all checks pass, render the coach's profile.
  return <CoachProfile userProfile={userProfile} />;
};

export default CoachProfilePage;
