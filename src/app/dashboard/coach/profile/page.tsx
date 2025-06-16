
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/types';
import CoachProfile from '@/components/CoachProfile';
import { Skeleton } from '@/components/ui/skeleton';

const CoachProfilePage = () => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const docRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(docRef, (doc) => {
        if (doc.exists()) {
          setUserProfile({ ...doc.data() as UserProfile, uid: doc.id });
        } else {
          console.log('No such document!');
        }
        setLoading(false);
      }, (error) => {
        console.error("Error listening to user profile updates:", error);
        // Optionally, you could also set some error state here to display a message to the user
        setLoading(false); // Ensure loading is also turned off on error
      });

      // Cleanup subscription on unmount
      return () => unsubscribe();
    }
  }, [user]);

  if (loading) {
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
    return <div>User profile not found.</div>;
  }

  return <CoachProfile userProfile={userProfile} />;
};

export default CoachProfilePage;
