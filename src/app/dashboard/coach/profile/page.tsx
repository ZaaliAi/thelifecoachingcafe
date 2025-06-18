"use client";

import { useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { EditCoachProfileForm, type EditProfileFormSubmitData } from '@/components/dashboard/EditCoachProfileForm';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { uploadProfileImage } from '@/services/imageUpload';

const CoachProfilePage = () => {
    const { user, loading, refetchUserProfile } = useAuth();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const handleProfileUpdate = useCallback(async (formData: EditProfileFormSubmitData) => {
        if (!user) {
            toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
            return;
        }

        console.log("1. Starting profile update. Initial form data:", formData);
        let imageUrl = formData.currentProfileImageUrl || null;
        console.log("2. Initial imageUrl:", imageUrl);

        try {
            if (formData.imageAction === 'replace' && formData.selectedFile) {
                toast({ title: "Uploading Image...", description: "Please wait." });
                imageUrl = await uploadProfileImage(formData.selectedFile, user.id, formData.currentProfileImageUrl);
                console.log("3a. Image uploaded. New imageUrl:", imageUrl);
            } else if (formData.imageAction === 'remove') {
                imageUrl = null;
                if (formData.currentProfileImageUrl) {
                    await uploadProfileImage(undefined, user.id, formData.currentProfileImageUrl);
                }
                console.log("3b. Image removed. New imageUrl:", imageUrl);
            }

            const profileData = {
                userId: user.id,
                name: formData.name,
                bio: formData.bio,
                specialties: formData.specialties,
                keywords: formData.keywords,
                certifications: formData.certifications,
                location: formData.location,
                websiteUrl: formData.websiteUrl,
                introVideoUrl: formData.introVideoUrl,
                linkedInUrl: formData.linkedInUrl,
                profileImageUrl: imageUrl,
            };

            console.log("4. Sending data to API:", profileData);
            const response = await fetch('/api/user-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to update profile from API.');
            }
            
            console.log("5. API update successful. Waiting 1 second before refetching profile.");
            toast({ title: "Success!", description: "Your profile has been updated. Refreshing data..." });

            // Wait 1 second to prevent race condition with database update
            setTimeout(() => {
                console.log("6. Refetching user profile.");
                refetchUserProfile();
            }, 1000);

        } catch (error: any) {
            console.error("Full error in handleProfileUpdate:", error);
            toast({ title: "Update Failed", description: error.message, variant: "destructive" });
        }
    }, [user, toast, refetchUserProfile]);
    
    useEffect(() => {
        if (searchParams.get('subscription_success')) {
            toast({
                title: "Payment Successful!",
                description: "Refreshing your profile...",
                duration: 5000,
            });
            const timer = setTimeout(() => {
                refetchUserProfile();
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [searchParams, refetchUserProfile, toast]);

    if (loading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    if (!user) {
        return <div className="p-4">You must be logged in to view this page.</div>;
    }

    return (
        <div className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold">Edit Your Coach Profile</h1>
                <p className="text-muted-foreground">This is where you can update your public coaching profile.</p>
            </header>
            <EditCoachProfileForm
                initialData={user}
                onSubmit={handleProfileUpdate}
                isPremiumCoach={user.subscriptionTier === 'premium'}
            />
        </div>
    );
};

export default CoachProfilePage;
