import { NextResponse } from 'next/server';
import { adminAuth, adminFirestore, FirebaseFirestoreNamespace } from '@/lib/firebaseAdmin';
import type { Testimonial, FirestoreUserProfile } from '@/types';

// TODO: Consider updating the GET handler if it's still needed,
// to align with the new Testimonial structure (clientName, testimonialText, coachId)
// and potentially add filtering/pagination if the list grows large.
// For now, the focus is on the POST request.

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) {
      return NextResponse.json({ error: 'Bad Request: coachId query parameter is required' }, { status: 400 });
    }

    const testimonialsRef = adminFirestore.collection('testimonials');
    const q = testimonialsRef.where('coachId', '==', coachId).orderBy('createdAt', 'desc');
    const snapshot = await q.get();

    if (snapshot.empty) {
      return NextResponse.json([], { status: 200 });
    }

    const testimonials: Testimonial[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Ensure data conforms to the Testimonial type, especially timestamps
      const testimonial: Testimonial = {
        id: doc.id,
        coachId: data.coachId,
        clientName: data.clientName,
        testimonialText: data.testimonialText,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(), // Fallback for safety
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : undefined,
        dataAiHint: data.dataAiHint,
      };
      testimonials.push(testimonial);
    });

    return NextResponse.json(testimonials, { status: 200 });

  } catch (error: any) {
    console.error('Error fetching testimonials:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (error) {
      console.error('Error verifying ID token:', error);
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const uid = decodedToken.uid;

    // Fetch user profile from Firestore
    const userDocRef = adminFirestore.collection('users').doc(uid);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists) {
      return NextResponse.json({ error: 'Forbidden: User profile not found' }, { status: 403 });
    }

    const userProfile = userDocSnap.data() as FirestoreUserProfile;

    // Verify user is a coach
    if (userProfile.role !== 'coach') {
      return NextResponse.json({ error: 'Forbidden: User is not a coach' }, { status: 403 });
    }

    // Premium check: Uncomment and adjust if premium status is a strict requirement for adding testimonials.
    // if (userProfile.subscriptionTier !== 'premium') {
    //   return NextResponse.json({ error: 'Forbidden: Only premium coaches can add testimonials' }, { status: 403 });
    // }

    // Testimonial Limit Check
    const testimonialsRef = adminFirestore.collection('testimonials');
    const q = testimonialsRef.where('coachId', '==', uid);
    const snapshot = await q.get(); // Get the QuerySnapshot
    const count = snapshot.size;     // Get the number of documents in the QuerySnapshot

    if (count >= 10) {
      return NextResponse.json({ error: 'Maximum number of testimonials reached (10)' }, { status: 400 });
    }

    // Input Validation
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json({ error: 'Bad Request: Invalid JSON body' }, { status: 400 });
    }

    const { clientName, testimonialText } = body;

    if (!clientName || typeof clientName !== 'string' || clientName.trim() === '') {
      return NextResponse.json({ error: 'Bad Request: clientName is required and must be a non-empty string' }, { status: 400 });
    }
    if (!testimonialText || typeof testimonialText !== 'string' || testimonialText.trim() === '') {
      return NextResponse.json({ error: 'Bad Request: testimonialText is required and must be a non-empty string' }, { status: 400 });
    }

    // Data Creation
    // Note: The Testimonial type in types/index.ts was updated to have coachId, clientName, testimonialText
    const newTestimonialData: Omit<Testimonial, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: any } = {
      coachId: uid,
      clientName: clientName.trim(),
      testimonialText: testimonialText.trim(),
      createdAt: FirebaseFirestoreNamespace.FieldValue.serverTimestamp(),
      // 'updatedAt' can be added here or by a Firestore trigger if necessary.
      // 'dataAiHint' is also part of the type, but not required here.
    };

    const docRef = await adminFirestore.collection('testimonials').add(newTestimonialData);

    // Respond with the ID of the newly created testimonial and the submitted data (serverTimestamp will be a placeholder client-side)
    // For a more complete response, one might fetch the document again to get the actual createdAt timestamp.
    // However, for a create operation, returning the ID and the input data is often sufficient.
    return NextResponse.json({
      id: docRef.id,
      coachId: newTestimonialData.coachId,
      clientName: newTestimonialData.clientName,
      testimonialText: newTestimonialData.testimonialText,
      // createdAt will be resolved by the client or on subsequent fetches
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating testimonial:', error);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') { // argument-error for malformed token
        return NextResponse.json({ error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
