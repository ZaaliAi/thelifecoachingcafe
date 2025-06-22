
import { NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebaseAdmin';
import type { HomepageTestimonial, FirestoreUserProfile } from '@/types';
import { headers } from 'next/headers';

// Helper to verify if the user is an admin
async function isAdmin(authorization: string | null): Promise<boolean> {
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

// GET handler to fetch all homepage testimonials
export async function GET(request: Request) {
  if (!(await isAdmin(headers().get('Authorization')))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const snapshot = await adminFirestore.collection('testimonials').get();
    if (snapshot.empty) {
      return NextResponse.json([], { status: 200 });
    }

    const testimonials: HomepageTestimonial[] = [];
    // Using a for...of loop for safer iteration
    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        
        // Skip document if it's missing crucial data
        if (!data || !data.name || !data.text) {
          console.warn(`Skipping malformed testimonial document: ${doc.id}`);
          continue; // Move to the next document
        }

        const testimonial: HomepageTestimonial = {
          id: doc.id,
          name: data.name,
          text: data.text,
          // Safely handle timestamps, providing a valid fallback
          createdAt: data.createdAt?.toDate()?.toISOString() ?? new Date(0).toISOString(),
          updatedAt: data.updatedAt?.toDate()?.toISOString() ?? null,
        };
        testimonials.push(testimonial);

      } catch (e) {
        // If an individual document fails to process, log it and skip it.
        console.error(`Could not process testimonial document ${doc.id}. Error:`, e);
      }
    }

    return NextResponse.json(testimonials, { status: 200 });

  } catch (error: any) {
    console.error('Fatal error fetching homepage testimonials:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST handler to create a new homepage testimonial
export async function POST(request: Request) {
  if (!(await isAdmin(headers().get('Authorization')))) {
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
      createdAt: adminFirestore.FieldValue.serverTimestamp(),
      updatedAt: adminFirestore.FieldValue.serverTimestamp(),
    });
    
    const newDoc = await docRef.get();
    const data = newDoc.data();

    return NextResponse.json({
        id: newDoc.id,
        name: data?.name,
        text: data?.text,
        createdAt: data?.createdAt.toDate().toISOString(),
        updatedAt: data?.updatedAt.toDate().toISOString(),
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating homepage testimonial:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
