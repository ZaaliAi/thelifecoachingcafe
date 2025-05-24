import { NextResponse } from 'next/server';
import { getUsersByIds } from '@/lib/userService';
import { UserProfile } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userIds } = body;

    if (!Array.isArray(userIds) || userIds.some(id => typeof id !== 'string')) {
      return NextResponse.json({ error: 'Invalid input: userIds must be an array of strings.' }, { status: 400 });
    }

    if (userIds.length === 0) {
      return NextResponse.json(new Map<string, UserProfile | null>());
    }
    
    // Ensure we don't query with too many IDs if there are API limits, though getUsersByIds handles chunking for Firestore.
    // You might add an overall limit here if desired, e.g., if (userIds.length > 50) return error.

    const profilesMap = await getUsersByIds(userIds);
    
    // NextResponse cannot directly serialize a Map, so convert it to an object or an array of [key, value] pairs.
    // Converting to an object is often more convenient for client-side usage.
    const profilesObject = Object.fromEntries(profilesMap);

    return NextResponse.json(profilesObject);

  } catch (error: any) {
    console.error('Error in /api/users/profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch user profiles', details: error.message }, { status: 500 });
  }
}
