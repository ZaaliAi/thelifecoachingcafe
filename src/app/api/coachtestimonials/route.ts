
import { NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebaseAdmin';
import type { CoachTestimonial, FirestoreUserProfile } from '@/types';
import { headers } from 'next/headers';

// This helper is focused and ensures the user is a valid coach
async function verifyUserIsCoach(authorization: string | null): Promise<string | null> {
    if (!authorization?.startsWith('Bearer ')) return null;
    const idToken = authorization.split('Bearer ')[1];
    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const userDoc = await adminFirestore.collection('users').doc(decodedToken.uid).get();
        if (userDoc.exists && (userDoc.data() as FirestoreUserProfile).role === 'coach') {
            return decodedToken.uid;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// GET testimonials for a specific coach
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');

    if (!coachId) {
        return NextResponse.json({ error: 'Coach ID is required.' }, { status: 400 });
    }

    try {
        const testimonialsRef = adminFirestore.collection('users').doc(coachId).collection('clienttestimonials');
        const snapshot = await testimonialsRef.get();

        if (snapshot.empty) {
            return NextResponse.json([], { status: 200 });
        }

        const testimonials: CoachTestimonial[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                coachId: coachId,
                clientName: data.clientName,
                testimonialText: data.testimonialText,
                createdAt: data.createdAt?.toDate()?.toISOString() || null,
                updatedAt: data.updatedAt?.toDate()?.toISOString() || null,
            };
        });

        return NextResponse.json(testimonials, { status: 200 });
    } catch (error) {
        console.error(`Error fetching testimonials for coach ${coachId}:`, error);
        return NextResponse.json({ error: 'Failed to fetch testimonials due to a server error.' }, { status: 500 });
    }
}

// POST a new testimonial for the authenticated coach
export async function POST(request: Request) {
    const coachId = await verifyUserIsCoach(headers().get('Authorization'));
    if (!coachId) {
        return NextResponse.json({ error: 'Forbidden: User is not an authorized coach.' }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { clientName, testimonialText } = body;

        if (!clientName || !testimonialText) {
            return NextResponse.json({ error: 'Client name and testimonial text are required.' }, { status: 400 });
        }

        const testimonialsRef = adminFirestore.collection('users').doc(coachId).collection('clienttestimonials');
        
        const snapshot = await testimonialsRef.get();
        if (snapshot.size >= 10) {
            return NextResponse.json({ error: 'You have reached the maximum of 10 testimonials.' }, { status: 400 });
        }

        const newTestimonial = {
            clientName,
            testimonialText,
            createdAt: adminFirestore.FieldValue.serverTimestamp(),
            updatedAt: adminFirestore.FieldValue.serverTimestamp(),
        };

        const docRef = await testimonialsRef.add(newTestimonial);
        
        return NextResponse.json({ id: docRef.id }, { status: 201 });

    } catch (error) {
        console.error(`Error creating testimonial for coach ${coachId}:`, error);
        return NextResponse.json({ error: 'Failed to create testimonial due to a server error.' }, { status: 500 });
    }
}
