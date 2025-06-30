
import { NextResponse } from 'next/server';
import { adminFirestore, FirebaseFirestoreNamespace } from '@/lib/firebaseAdmin';
import type { HomepageTestimonial } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

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
      // Ignore parsing errors and return null below
    }
  }
  // Return null if conversion is not possible or input is invalid
  return null;
}

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

    const data = doc.data();

    const testimonialData: HomepageTestimonial = { 
      id: doc.id,
      name: data?.name ?? 'No Name',
      text: data?.text ?? 'No Text',
      createdAt: safeToISOString(data?.createdAt) ?? new Date(0).toISOString(),
      updatedAt: safeToISOString(data?.updatedAt),
    };

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

    // Create a clean update object, excluding fields that shouldn't be changed by the client.
    const updateData: { [key: string]: any } = {
      name: testimonialData.name,
      text: testimonialData.text,
      updatedAt: FieldValue.serverTimestamp(), // Use FieldValue for server-side timestamp
    };

    // Remove any undefined fields to avoid errors
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    await testimonialRef.update(updateData);

    const updatedDoc = await testimonialRef.get();
    const updatedData = updatedDoc.data();

    const updatedTestimonial: HomepageTestimonial = {
      id: updatedDoc.id,
      name: updatedData?.name,
      text: updatedData?.text,
      createdAt: safeToISOString(updatedData?.createdAt),
      updatedAt: safeToISOString(updatedData?.updatedAt),
    };

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
