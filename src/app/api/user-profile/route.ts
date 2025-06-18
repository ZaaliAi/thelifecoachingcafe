// src/app/api/user-profile/route.ts
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

// This helper function ensures that any keys with an undefined value
// are instead set to null, which is a valid Firestore type.
const cleanData = (obj: { [key: string]: any }) => {
  const newObj: { [key: string]: any } = {};
  for (const key in obj) {
    newObj[key] = obj[key] === undefined ? null : obj[key];
  }
  return newObj;
};

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log('[api/user-profile] Received data for update:', data);

    const {
      userId,
      name,
      bio,
      specialties,
      keywords,
      certifications,
      location,
      websiteUrl,
      introVideoUrl,
      linkedInUrl,
      profileImageUrl
    } = data;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    
    // Construct the data payload exactly as the Firestore document expects.
    const userUpdateData = {
      name,
      bio,
      specialties,
      keywords,
      certifications,
      location,
      websiteUrl,
      introVideoUrl,
      // Create the socialLinks array structure
      socialLinks: linkedInUrl ? [{ platform: 'LinkedIn', url: linkedInUrl }] : [],
      profileImageUrl,
      updatedAt: FieldValue.serverTimestamp(),
    };

    // Clean the data to prevent 'undefined' errors before saving.
    const cleanedData = cleanData(userUpdateData);

    console.log(`[api/user-profile] Attempting to update user ${userId} with cleaned data.`);
    
    // Use set with merge:true to update the single user document.
    await userRef.set(cleanedData, { merge: true });

    console.log(`[api/user-profile] Successfully updated profile for user ${userId}.`);
    return NextResponse.json({ message: 'Profile updated successfully.' });

  } catch (error: any) {
    console.error('[api/user-profile] Critical error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile due to a server error.', details: error.message }, { status: 500 });
  }
}
