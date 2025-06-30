
import { NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebaseAdmin';
import type { HomepageTestimonial, FirestoreUserProfile } from '@/types';
import { headers } from 'next/headers';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

// Helper to safely convert a Firestore timestamp or other date format to an ISO string.
function safeToISOString(dateValue: any): string | null {
  if (!dateValue) {
    return null;
  }
  // If it's a Firestore Timestamp, convert it
  if (dateValue instanceof Timestamp) {
    return dateValue.toDate().toISOString();
  }
  // If it's a JS Date object
  if (dateValue instanceof Date) {
    return dateValue.toISOString();
  }
  // If it's a string or number, try to parse it
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  // Return null if conversion is not possible
  return null;
}


// Helper to verify if the user is an admin
async function isAdmin(authorization: string | null): Promise<boolean> {
  // Early exit if the SDK is not initialized
  if (!adminAuth || !adminFirestore) {
    console.error("isAdmin check failed: Firebase Admin SDK is not initialized.");
    return false;
  }

  if (!authorization?.startsWith('Bearer ')) return false;
  const idToken = authorization.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userDoc = await adminFirestore.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) return false;
    const userProfile = userDoc.data() as FirestoreUserProfile;
    return userProfile.role === 'admin';
  } catch (error) {
    console.error("Error verifying admin token:", error);
    return false;
  }
}

// A helper to create a standard error response for when the SDK is not available.
function createSdkNotInitializedResponse(serviceName: string) {
  const errorMessage = `Internal Server Error: The ${serviceName} service is not available. Check server logs for Firebase initialization errors.`;
  console.error(errorMessage);
  return NextResponse.json({ error: errorMessage }, { status: 500 });
}


// GET handler to fetch all homepage testimonials
export async function GET(request: Request) {
  // Ensure Firestore service is available before proceeding
  if (!adminFirestore) {
    return createSdkNotInitializedResponse('Firestore');
  }

  const authorization = headers().get('Authorization');
  if (!(await isAdmin(authorization))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const snapshot = await adminFirestore.collection('testimonials').get();
    if (snapshot.empty) {
      return NextResponse.json([], { status: 200 });
    }

    const testimonials: HomepageTestimonial[] = [];
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        if (!data || !data.name || !data.text) {
          console.warn(`Skipping malformed testimonial document: ${doc.id}`);
          continue;
        }

        const createdAt = safeToISOString(data.createdAt);
        const updatedAt = safeToISOString(data.updatedAt);

        testimonials.push({
          id: doc.id,
          name: data.name,
          text: data.text,
          createdAt: createdAt ?? new Date(0).toISOString(),
          updatedAt: updatedAt,
        });
      } catch (e) {
        console.error(`Could not process testimonial document ${doc.id}. Error:`, e);
      }
    }
    
    return NextResponse.json(testimonials, { status: 200 });

  } catch (error: any) {
    console.error('Fatal error fetching homepage testimonials:', error);
    return NextResponse.json({ 
        error: 'Internal Server Error',
        details: error.message 
    }, { status: 500 });
  }
}

// POST handler to create a new homepage testimonial
export async function POST(request: Request) {
    // Ensure Firestore service is available before proceeding
  if (!adminFirestore) {
    return createSdkNotInitializedResponse('Firestore');
  }
  
  const authorization = headers().get('Authorization');
  if (!(await isAdmin(authorization))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, text } = body;

    if (!name || !text) {
      return NextResponse.json({ error: 'Missing name or text' }, { status: 400 });
    }

    const docRef = await adminFirestore.collection('testimonials').add({
      name,
      text,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    const newDoc = await docRef.get();
    const data = newDoc.data();

    // After creation, serverTimestamp() might be pending, so we read it back.
    // The safeToISOString handles the Timestamp object correctly.
    const now = new Date().toISOString();
    const createdAt = data?.createdAt ? safeToISOString(data.createdAt) : now;
    const updatedAt = data?.updatedAt ? safeToISOString(data.updatedAt) : now;

    return NextResponse.json({
        id: newDoc.id,
        name: data?.name,
        text: data?.text,
        createdAt: createdAt,
        updatedAt: updatedAt,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating homepage testimonial:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
