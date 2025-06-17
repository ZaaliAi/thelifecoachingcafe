import { NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebaseAdmin';
import type { FirestoreUserProfile } from '@/types'; // Assuming Testimonial type itself is not directly needed here, only for casting coachId from it.

export async function DELETE(
  request: Request,
  { params }: { params: { testimonialId: string } }
) {
  try {
    const { testimonialId } = params;
    if (!testimonialId) {
      // This case should ideally be handled by Next.js routing if the path is hit
      return NextResponse.json({ error: 'Bad Request: testimonialId is required' }, { status: 400 });
    }

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

    // Fetch the testimonial document
    const testimonialDocRef = adminFirestore.collection('testimonials').doc(testimonialId);
    const testimonialDocSnap = await testimonialDocRef.get();

    if (!testimonialDocSnap.exists()) {
      return NextResponse.json({ error: 'Not Found: Testimonial not found' }, { status: 404 });
    }

    const testimonialData = testimonialDocSnap.data();
    const coachIdFromTestimonial = testimonialData?.coachId;

    if (!coachIdFromTestimonial) {
        // This would indicate a data integrity issue if a testimonial doesn't have a coachId
        console.error(`Testimonial ${testimonialId} is missing coachId.`);
        return NextResponse.json({ error: 'Internal Server Error: Testimonial data incomplete' }, { status: 500 });
    }

    // Fetch the user profile of the deleter to check for admin role
    const userDocRef = adminFirestore.collection('users').doc(uid);
    const userDocSnap = await userDocRef.get();

    if (!userDocSnap.exists()) {
      // User trying to delete must have a profile.
      return NextResponse.json({ error: 'Forbidden: User profile not found' }, { status: 403 });
    }
    const userProfile = userDocSnap.data() as FirestoreUserProfile;

    // Check for ownership or admin role
    const isOwner = coachIdFromTestimonial === uid;
    const isAdmin = userProfile.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden: User is not authorized to delete this testimonial' }, { status: 403 });
    }

    // Perform the deletion
    await testimonialDocRef.delete();

    return NextResponse.json({ message: 'Testimonial deleted successfully' }, { status: 200 });

  } catch (error: any) {
    console.error(`Error deleting testimonial ${params.testimonialId}:`, error);
    if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        return NextResponse.json({ error: 'Unauthorized: Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
