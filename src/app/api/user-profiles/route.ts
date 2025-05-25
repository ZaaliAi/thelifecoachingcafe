import { NextResponse } from 'next/server';
import { getUsersByIds } from '@/lib/userService'; // This is fine here (server-side)
import { UserProfile } from '@/types'; // Ensure UserProfile type is available

export async function POST(request: Request) {
  try {
    const { userIds } = await request.json();

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: 'User IDs are required and must be an array.' }, { status: 400 });
    }

    // Ensure all IDs are strings, filter out any non-string IDs if necessary
    const validUserIds = userIds.filter(id => typeof id === 'string');
    if (validUserIds.length === 0) {
        return NextResponse.json({ error: 'No valid user IDs provided.' }, { status: 400 });
    }

    console.log('[api/user-profiles] Fetching profiles for IDs:', validUserIds);
    const profilesMap = await getUsersByIds(validUserIds);

    // Convert Map to a plain object for JSON serialization
    const profilesObject: { [key: string]: UserProfile | null } = {};
    profilesMap.forEach((value, key) => {
      profilesObject[key] = value;
    });
    
    console.log('[api/user-profiles] Successfully fetched profiles:', profilesObject);
    return NextResponse.json(profilesObject);

  } catch (error: any) {
    console.error('[api/user-profiles] Error fetching user profiles:', error);
    return NextResponse.json({ error: 'Failed to fetch user profiles', details: error.message }, { status: 500 });
  }
}
