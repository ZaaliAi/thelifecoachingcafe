import { NextResponse } from 'next/server';
import { adminFirestore, FirebaseFirestoreNamespace } from '@/lib/firebaseAdmin';
import { Testimonial } from '@/types';

// GET handler to fetch all testimonials
export async function GET() {
  try {
    const testimonialsRef = adminFirestore.collection('testimonials');
    const snapshot = await testimonialsRef.orderBy('createdAt', 'desc').get();

    if (snapshot.empty) {
      return NextResponse.json([], { status: 200 });
    }

    const testimonials: Testimonial[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      testimonials.push({
        id: doc.id,
        name: data.name,
        text: data.text,
        imageUrl: data.imageUrl,
        designation: data.designation,
        createdAt: data.createdAt.toDate ? data.createdAt.toDate().toISOString() : new Date(data.createdAt._seconds * 1000).toISOString(),
        updatedAt: data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : new Date(data.updatedAt._seconds * 1000).toISOString(),
      });
    });

    return NextResponse.json(testimonials, { status: 200 });
  } catch (error: any) {
    console.error('[api/testimonials] Error fetching testimonials:', error);
    return NextResponse.json({ error: 'Failed to fetch testimonials', details: error.message }, { status: 500 });
  }
}

// POST handler to create a new testimonial
export async function POST(request: Request) {
  try {
    const testimonialData = await request.json();

    // Basic validation
    if (!testimonialData.name || !testimonialData.text) {
      return NextResponse.json({ error: 'Name and text are required fields.' }, { status: 400 });
    }

    const newTestimonialRef = adminFirestore.collection('testimonials').doc();
    const now = FirebaseFirestoreNamespace.Timestamp.now();

    const newTestimonial: Omit<Testimonial, 'id'> = {
      name: testimonialData.name,
      text: testimonialData.text,
      imageUrl: testimonialData.imageUrl || null,
      designation: testimonialData.designation || null,
      createdAt: now,
      updatedAt: now,
    };

    await newTestimonialRef.set(newTestimonial);

    return NextResponse.json({ id: newTestimonialRef.id, ...newTestimonial }, { status: 201 });
  } catch (error: any) {
    console.error('[api/testimonials] Error creating testimonial:', error);
    return NextResponse.json({ error: 'Failed to create testimonial', details: error.message }, { status: 500 });
  }
}
