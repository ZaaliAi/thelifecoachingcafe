// src/app/api/user-profile/route.ts
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { userId, ...profileData } = data;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);

    // Build a clean update object from scratch to ensure no invalid data is sent.
    const userUpdateData: { [key: string]: any } = {
        updatedAt: FieldValue.serverTimestamp(),
    };

    // Conditionally add each field, converting empty strings to null for optional fields.
    if (profileData.name !== undefined) userUpdateData.name = profileData.name;
    if (profileData.bio !== undefined) userUpdateData.bio = profileData.bio;
    if (profileData.tagline !== undefined) userUpdateData.tagline = profileData.tagline || null;
    if (profileData.location !== undefined) userUpdateData.location = profileData.location || null;
    if (profileData.websiteUrl !== undefined) userUpdateData.websiteUrl = profileData.websiteUrl || null;
    if (profileData.introVideoUrl !== undefined) userUpdateData.introVideoUrl = profileData.introVideoUrl || null;
    if (profileData.profileImageUrl !== undefined) userUpdateData.profileImageUrl = profileData.profileImageUrl;
    
    // Safely handle array fields.
    if (Array.isArray(profileData.specialties)) userUpdateData.specialties = profileData.specialties;
    if (Array.isArray(profileData.keywords)) userUpdateData.keywords = profileData.keywords;
    if (Array.isArray(profileData.certifications)) userUpdateData.certifications = profileData.certifications;

    // Explicitly validate and sanitize the availability array.
    if (Array.isArray(profileData.availability)) {
        userUpdateData.availability = profileData.availability
            .map((slot: any) => ({
                day: slot.day || null,
                time: slot.time || null,
            }))
            .filter((slot: any) => slot.day && slot.time);
    } else {
        // If no availability is provided, ensure it's a clean empty array.
        userUpdateData.availability = [];
    }
    
    // Safely update socialLinks (specifically for LinkedIn).
    if (profileData.linkedInUrl !== undefined) {
        if (profileData.linkedInUrl) {
            userUpdateData.socialLinks = [{ platform: 'LinkedIn', url: profileData.linkedInUrl }];
        } else {
            userUpdateData.socialLinks = [];
        }
    }
    
    // Use the `update` method, which is safer than `set` with merge for this case.
    await userRef.update(userUpdateData);

    return NextResponse.json({ message: 'Profile updated successfully.' });

  } catch (error: any) {
    console.error('[api/user-profile] Critical error updating profile:', error);
    return NextResponse.json({ 
        error: 'Failed to update profile due to a server error.', 
        details: error.message,
    }, { status: 500 });
  }
}

