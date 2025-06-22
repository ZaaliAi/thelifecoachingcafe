
import { NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebaseAdmin';
import type { FirestoreUserProfile } from '@/types';

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

async function handleRequest(
    request: Request,
    params: { testimonialId: string },
    method: 'DELETE' | 'PUT'
) {
    const coachId = await verifyUserIsCoach(request.headers.get('Authorization'));
    if (!coachId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { testimonialId } = params;
    if (!testimonialId) {
        return NextResponse.json({ error: 'Testimonial ID is required' }, { status: 400 });
    }

    try {
        const docRef = adminFirestore
            .collection('users')
            .doc(coachId)
            .collection('clienttestimonials')
            .doc(testimonialId);

        if (method === 'DELETE') {
            await docRef.delete();
            return NextResponse.json({ message: 'Testimonial deleted' }, { status: 200 });
        }

        if (method === 'PUT') {
            const body = await request.json();
            const { clientName, testimonialText } = body;
            if (!clientName || !testimonialText) {
                return NextResponse.json({ error: 'Client name and text are required' }, { status: 400 });
            }
            await docRef.update({
                clientName,
                testimonialText,
                updatedAt: adminFirestore.FieldValue.serverTimestamp(),
            });
            return NextResponse.json({ message: 'Testimonial updated' }, { status: 200 });
        }

    } catch (error) {
        console.error(`Error with testimonial ${testimonialId} for coach ${coachId}:`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE(request: Request, { params }: { params: { testimonialId: string } }) {
    return handleRequest(request, params, 'DELETE');
}

export async function PUT(request: Request, { params }: { params: { testimonialId: string } }) {
    return handleRequest(request, params, 'PUT');
}
