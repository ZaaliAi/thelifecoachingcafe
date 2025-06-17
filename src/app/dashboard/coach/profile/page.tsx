'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile } from '@/types'; // Assuming UserProfile includes uid or id
import CoachProfile from '@/components/CoachProfile';
import { Skeleton } from '@/components/ui/skeleton';

const CoachProfilePage = () => {
  const { user, loading: authLoading } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true); // Start true if auth might be loading

  console.log('[CoachProfilePage] Rendering. Initial authLoading:', authLoading, 'Initial user from useAuth():', user);

  useEffect(() => {
    console.log('[CoachProfilePage] useEffect triggered. Current user from useAuth():', user, 'AuthLoading:', authLoading);

    if (user && user.uid) {
      console.log('[CoachProfilePage] useEffect: User and user.uid exist. UID:', user.uid, '. Attempting to set up Firestore listener.');
      setProfileLoading(true);
      const docRef = doc(db, 'users', user.uid);
      const unsubscribe = onSnapshot(docRef, (doc) => {
        console.log('[CoachProfilePage] onSnapshot callback triggered. Doc received. Doc exists?', doc.exists());
        if (doc.exists()) {
          const data = doc.data() as UserProfile; // Assuming UserProfile type matches doc structure
          console.log('[CoachProfilePage] onSnapshot: Document exists. Data:', data);
          setUserProfile({ ...data, uid: doc.id }); // Ensure uid is part of UserProfile or added here
        } else {
          console.log('[CoachProfilePage] onSnapshot: No profile document found for user UID:', user.uid);
          setUserProfile(null);
        }
        setProfileLoading(false);
      }, (error) => {
        console.error('[CoachProfilePage] onSnapshot: Error listening to user profile updates for UID:', user.uid, error);
        setUserProfile(null);
        setProfileLoading(false);
      });
      
      return () => {
        console.log('[CoachProfilePage] useEffect cleanup. Unsubscribing from Firestore listener for UID:', user.uid);
        unsubscribe();
      };
    } else {
      console.log('[CoachProfilePage] useEffect: User or user.uid is missing or auth still loading. User:', user, 'AuthLoading:', authLoading);
      if (!authLoading && !user) {
        // No user and auth is done, so no profile to load.
        // The main render logic will show "User profile not found" or similar.
        setProfileLoading(false);
      } else if (authLoading) {
        // Still waiting for auth to resolve, keep profileLoading true or let initial state handle it.
        // setProfileLoading(true); // Or rely on initial useState(true)
      }
    }
  }, [user, authLoading]); // Added authLoading to dependency array as it's used in the else block

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
    // This should ideally not be reached if AuthProvider handles redirects,
    // but as a fallback for this page's logic.
    return <div className="p-4">User profile not found. Please log in.</div>;
  }
  
  // User is available, now check profileLoading state (set by useEffect)
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

  // Auth is done, user exists, profile loading is done. Now check if userProfile was actually found.
  if (!userProfile) {
    console.log('[CoachProfilePage] Render: userProfile is null. Displaying "Your user profile could not be loaded."');
    return <div className="p-4">Your user profile could not be loaded. Please contact support. (Hint: Check console for Firestore errors or 'No document' messages for your user ID).</div>;
  }

  console.log('[CoachProfilePage] Render: Rendering CoachProfile with userProfile:', userProfile);
  // Ensure userProfile has a 'uid' or 'id' field as expected by CoachProfile's coachId prop.
  // The spread { ...data, uid: doc.id } in onSnapshot should ensure this.
  return <CoachProfile coachData={userProfile} coachId={userProfile.uid} />;
};

export default CoachProfilePage;
