import { adminFirestore, FirebaseFirestoreNamespace } from './firebaseAdmin'; // Import FirebaseFirestoreNamespace
import type { UserProfile } from '@/types';

/**
 * Fetches user profiles for a given list of user IDs.
 * It checks both 'users' and 'coachProfiles' collections.
 */
export async function getUsersByIds(userIds: string[]): Promise<Map<string, UserProfile | null>> {
  const profilesMap = new Map<string, UserProfile | null>();
  if (!userIds || userIds.length === 0) {
    return profilesMap;
  }

  const uniqueUserIds = Array.from(new Set(userIds));
  const MAX_IDS_PER_QUERY = 10;
  const chunks: string[][] = [];
  for (let i = 0; i < uniqueUserIds.length; i += MAX_IDS_PER_QUERY) {
    chunks.push(uniqueUserIds.slice(i, i + MAX_IDS_PER_QUERY));
  }

  for (const chunk of chunks) {
    if (chunk.length === 0) continue;

    try {
      console.log(`Fetching profiles for IDs (chunk): ${chunk.join(', ')}`);
      chunk.forEach(id => profilesMap.set(id, null));

      // Use FirebaseFirestoreNamespace.FieldPath.documentId()
      const usersSnapshot = await adminFirestore.collection('users').where(FirebaseFirestoreNamespace.FieldPath.documentId(), 'in', chunk).get();
      usersSnapshot.forEach(doc => {
        if (doc.exists) {
          const userData = doc.data();
          profilesMap.set(doc.id, {
            id: doc.id,
            name: userData.name || undefined,
            email: userData.email,
          });
        }
      });

      // Use FirebaseFirestoreNamespace.FieldPath.documentId()
      const coachesSnapshot = await adminFirestore.collection('coachProfiles').where(FirebaseFirestoreNamespace.FieldPath.documentId(), 'in', chunk).get();
      coachesSnapshot.forEach(doc => {
        if (doc.exists) {
          const coachData = doc.data();
          const existingProfile = profilesMap.get(doc.id);
          const coachName = coachData.name || undefined;
          
          if (coachName) {
            profilesMap.set(doc.id, {
              ...(existingProfile || {}),
              id: doc.id,
              name: coachName,
            });
          } else if (!existingProfile?.name && !coachName) {
             profilesMap.set(doc.id, {
              ...(existingProfile || {}),
              id: doc.id,
              name: 'Anonymous User',
            });
          }
        }
      });
      
      chunk.forEach(id => {
        const profile = profilesMap.get(id);
        if (profile && !profile.name) {
            profile.name = 'Anonymous User';
        }
      });

      console.log(`Successfully processed profile chunk. Users found: ${usersSnapshot.size}, Coaches found: ${coachesSnapshot.size}`);
    } catch (error) {
      console.error('Error fetching user/coach profiles for chunk ', chunk, ':', error);
      chunk.forEach(id => {
        if (!profilesMap.has(id) || !profilesMap.get(id)) { 
           profilesMap.set(id, { id, name: 'Error Fetching Name' } as UserProfile); 
        }
      });
    }
  }
  return profilesMap;
}
