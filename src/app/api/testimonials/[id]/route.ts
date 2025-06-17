import { NextResponse } from 'next/server';
import { adminFirestore, FirebaseFirestoreNamespace } from '@/lib/firebaseAdmin';
import type { Testimonial } from '@/types';

// GET handler to fetch a single testimonial by ID
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Testimonial ID is required.' }, { status: 400 });
    }

    const testimonialRef = adminFirestore.collection('testimonials').doc(id);
    const doc = await testimonialRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Testimonial not found.' }, { status: 404 });
    }

    const testimonialData = { id: doc.id, ...doc.data() } as Testimonial;
    
    // Convert Firestore Timestamps to ISO strings
    if (testimonialData.createdAt && typeof testimonialData.createdAt !== 'string') {
      testimonialData.createdAt = testimonialData.createdAt.toDate().toISOString();
    }
    if (testimonialData.updatedAt && typeof testimonialData.updatedAt !== 'string') {
      testimonialData.updatedAt = testimonialData.updatedAt.toDate().toISOString();
    }

    return NextResponse.json(testimonialData, { status: 200 });

  } catch (error: any) {
    console.error(`[api/testimonials/${params.id}] Error fetching testimonial:`, error);
    return NextResponse.json({ error: 'Failed to fetch testimonial', details: error.message }, { status: 500 });
  }
}

// PUT handler to update an existing testimonial
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Testimonial ID is required.' }, { status: 400 });
    }

    const testimonialData = await request.json();
    if (Object.keys(testimonialData).length === 0) {
      return NextResponse.json({ error: 'No data provided for update.' }, { status: 400 });
    }

    const testimonialRef = adminFirestore.collection('testimonials').doc(id);
    const doc = await testimonialRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Testimonial not found.' }, { status: 404 });
    }

    const updateData: Partial<Testimonial> = { ...testimonialData };
    updateData.updatedAt = FirebaseFirestoreNamespace.Timestamp.now();

    // Remove id from updateData if present, as it should not be changed
    if (updateData.id) {
      delete updateData.id;
    }
    // Ensure createdAt is not overwritten
    if (updateData.createdAt) {
        delete updateData.createdAt;
    }


    await testimonialRef.update(updateData);

    const updatedDoc = await testimonialRef.get();
    const updatedTestimonial = { id: updatedDoc.id, ...updatedDoc.data() } as Testimonial;

    // Convert Firestore Timestamps to ISO strings for the response
    if (updatedTestimonial.createdAt && typeof updatedTestimonial.createdAt !== 'string') {
        updatedTestimonial.createdAt = updatedTestimonial.createdAt.toDate ? updatedTestimonial.createdAt.toDate().toISOString() : new Date(updatedTestimonial.createdAt._seconds * 1000).toISOString();
    }
    if (updatedTestimonial.updatedAt && typeof updatedTestimonial.updatedAt !== 'string') {
        updatedTestimonial.updatedAt = updatedTestimonial.updatedAt.toDate ? updatedTestimonial.updatedAt.toDate().toISOString() : new Date(updatedTestimonial.updatedAt._seconds * 1000).toISOString();
    }


    return NextResponse.json(updatedTestimonial, { status: 200 });
  } catch (error: any) {
    console.error(`[api/testimonials/${params.id}] Error updating testimonial:`, error);
    return NextResponse.json({ error: 'Failed to update testimonial', details: error.message }, { status: 500 });
  }
}

// DELETE handler to delete a testimonial
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Testimonial ID is required.' }, { status: 400 });
    }

    const testimonialRef = adminFirestore.collection('testimonials').doc(id);
    const doc = await testimonialRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Testimonial not found.' }, { status: 404 });
    }

    await testimonialRef.delete();

    return NextResponse.json({ message: 'Testimonial deleted successfully.' }, { status: 200 });
  } catch (error: any) {
    console.error(`[api/testimonials/${params.id}] Error deleting testimonial:`, error);
    return NextResponse.json({ error: 'Failed to delete testimonial', details: error.message }, { status: 500 });
  }
}
