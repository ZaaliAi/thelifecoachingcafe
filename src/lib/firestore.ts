
// src/lib/firestore.ts
import type { Timestamp } from "firebase/firestore";
import { 
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs, 
  serverTimestamp, limit as firestoreLimit, updateDoc, where, writeBatch, collectionGroup
} from "firebase/firestore";
import { db } from "./firebase";
import type { Coach, BlogPost, FirestoreUserProfile, FirestoreBlogPost } from '@/types';

// Helper to convert Firestore Timestamps to ISO strings for a coach object
const mapCoachFromFirestore = (docData: any, id: string): Coach => {
  const data = docData as Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: Timestamp, updatedAt?: Timestamp };
  // console.log(`[mapCoachFromFirestore] Mapping coach ID: ${id}, Data:`, data);
  return {
    id,
    name: data.name || 'Unnamed Coach',
    email: data.email,
    bio: data.bio || 'No bio available.',
    role: data.role || 'coach', // Default to 'coach' if not present, though rules expect it
    specialties: data.specialties || [],
    keywords: data.keywords || [],
    profileImageUrl: data.profileImageUrl,
    dataAiHint: data.dataAiHint,
    certifications: data.certifications,
    socialLinks: data.socialLinks,
    location: data.location,
    availability: data.availability,
    subscriptionTier: data.subscriptionTier || 'free',
    websiteUrl: data.websiteUrl,
    introVideoUrl: data.introVideoUrl,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
    dataSource: 'Firestore',
  } as Coach;
};

// Helper to convert Firestore Timestamps to ISO strings for a blog post object
const mapBlogPostFromFirestore = (docData: any, id: string): BlogPost => {
  const data = docData as Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: Timestamp, updatedAt?: Timestamp };
  return {
    ...data,
    id,
    createdAt: data.createdAt.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
    tags: data.tags || [],
  } as BlogPost;
};


export async function setUserProfile(userId: string, profileData: Partial<Omit<FirestoreUserProfile, 'id'>>) {
  if (!userId) {
    console.error("setUserProfile: userId is undefined or null.");
    throw new Error("User ID is required to set user profile.");
  }
  console.log(`[setUserProfile] Attempting to write to /users/${userId}. Raw incoming profileData:`, JSON.stringify(profileData, null, 2));
  
  try {
    const userDocRef = doc(db, "users", userId);
    const userSnap = await getDoc(userDocRef);

    const dataToSet: any = {
      ...profileData, // Spread incoming data
      // Ensure critical fields expected by rules are present or defaulted
      name: profileData.name || 'Unnamed User',
      email: profileData.email, // Should always be present from auth
      role: profileData.role || 'user', // Default to 'user' if not specified, though auth.tsx should specify
      updatedAt: serverTimestamp(),
    };

    // Only add createdAt if the document is new or createdAt is missing
    if (!userSnap.exists() || !userSnap.data()?.createdAt) {
      dataToSet.createdAt = serverTimestamp();
    }
    
    // Explicitly handle optional fields that rules might check with hasOnly
    // If a field is meant to be optional on creation, ensure it's either present or correctly omitted
    // from `dataToSet` if not in `profileData`.
    // The `...profileData` spread handles fields present in `profileData`.
    // For fields checked by `hasOnly` but potentially not in `profileData`:
    if (!('subscriptionTier' in dataToSet) && dataToSet.role === 'coach') {
      dataToSet.subscriptionTier = 'free'; // Default for coaches if not provided
    }
    if (!('profileImageUrl' in dataToSet)) {
      dataToSet.profileImageUrl = null; // Default to null if not provided
    }


    console.log(`[setUserProfile] Final data object for setDoc on /users/${userId}:`, JSON.stringify(dataToSet, null, 2));
    await setDoc(userDocRef, dataToSet, { merge: true });
    console.log(`[setUserProfile] User profile data written successfully for user: ${userId}`);
  } catch (error) {
    console.error(`[setUserProfile] Error creating/updating user profile for ${userId}:`, error);
    throw error;
  }
}


export async function getUserProfile(userId: string): Promise<(FirestoreUserProfile & {id: string}) | null> {
  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const data = userDoc.data() as FirestoreUserProfile;
      return { id: userDoc.id, ...data };
    } else {
      console.log(`[getUserProfile] No profile found for user ${userId}`);
      return null;
    }
  } catch (error) {
    console.error(`[getUserProfile] Error getting user profile for ${userId}:`, error);
    throw error;
  }
}

export async function createFirestoreBlogPost(postData: Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const blogsCollection = collection(db, "blogs");
    const dataWithTimestamps = {
      ...postData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    console.log("[createFirestoreBlogPost] Attempting to create blog post with data:", JSON.stringify(dataWithTimestamps, null, 2));
    const newPostRef = await addDoc(blogsCollection, dataWithTimestamps);
    console.log("[createFirestoreBlogPost] Blog post created successfully with ID:", newPostRef.id);
    return newPostRef.id;
  } catch (error) {
    console.error("[createFirestoreBlogPost] Error creating blog post:", error);
    throw error;
  }
}

export async function updateFirestoreBlogPost(postId: string, postData: Partial<Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'authorId' | 'authorName' | 'slug'>>) {
    try {
        const postDocRef = doc(db, "blogs", postId);
        const dataWithTimestamp = {
            ...postData,
            updatedAt: serverTimestamp()
        };
        console.log(`[updateFirestoreBlogPost] Attempting to update blog post ${postId} with data:`, JSON.stringify(dataWithTimestamp, null, 2));
        await updateDoc(postDocRef, dataWithTimestamp);
        console.log(`[updateFirestoreBlogPost] Blog post updated successfully: ${postId}`);
    } catch (error) {
        console.error(`[updateFirestoreBlogPost] Error updating blog post ${postId}:`, error);
        throw error;
    }
}


export async function getFirestoreBlogPost(postId: string): Promise<BlogPost | null> {
  try {
    const postDocRef = doc(db, "blogs", postId);
    const postDoc = await getDoc(postDocRef);

    if (postDoc.exists()) {
      return mapBlogPostFromFirestore(postDoc.data(), postDoc.id);
    } else {
      return null;
    }
  } catch (error) {
    console.error("[getFirestoreBlogPost] Error getting blog post:", error);
    throw error;
  }
}

export async function getFirestoreBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    try {
        const blogsCollection = collection(db, "blogs");
        const q = query(blogsCollection, where("slug", "==", slug), firestoreLimit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const postDoc = querySnapshot.docs[0];
            return mapBlogPostFromFirestore(postDoc.data(), postDoc.id);
        } else {
            return null;
        }
    } catch (error) {
        console.error("[getFirestoreBlogPostBySlug] Error getting blog post by slug:", error);
        throw error;
    }
}

export async function getPublishedBlogPosts(count = 10): Promise<BlogPost[]> {
  try {
    const blogsCollection = collection(db, "blogs");
    const q = query(
        blogsCollection, 
        where("status", "==", "published"), 
        orderBy("createdAt", "desc"), 
        firestoreLimit(count)
    );
    const querySnapshot = await getDocs(q);
    console.log(`[getPublishedBlogPosts] Fetched ${querySnapshot.docs.length} published posts.`);
    return querySnapshot.docs.map(doc => mapBlogPostFromFirestore(doc.data(), doc.id));
  } catch (error) {
    console.error("[getPublishedBlogPosts] Error getting published blog posts:", error);
    throw error; 
  }
}

export async function getBlogPostsByAuthor(authorId: string, count = 10): Promise<BlogPost[]> {
    try {
        const blogsCollection = collection(db, "blogs");
        const q = query(
            blogsCollection,
            where("authorId", "==", authorId),
            orderBy("createdAt", "desc"),
            firestoreLimit(count)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => mapBlogPostFromFirestore(doc.data(), doc.id));
    } catch (error) {
        console.error("[getBlogPostsByAuthor] Error getting blog posts by author:", error);
        throw error;
    }
}

export async function getAllCoaches(filters?: { searchTerm?: string }): Promise<Coach[]> {
    console.log("[getAllCoaches] Attempting to fetch coaches. Filters:", filters);
    try {
        const coachesQuery = query(collection(db, "users"), where("role", "==", "coach"), orderBy("name", "asc"));
        
        console.log("[getAllCoaches] Executing query to Firestore...");
        const querySnapshot = await getDocs(coachesQuery);
        console.log(`[getAllCoaches] Firestore query returned ${querySnapshot.docs.length} documents with role 'coach'.`);

        const allCoaches = querySnapshot.docs.map(docSnapshot => {
          // console.log(`[getAllCoaches] Mapping document: ${docSnapshot.id}, data:`, docSnapshot.data());
          return mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
        });
        
        if (filters?.searchTerm) {
            const lowerSearchTerm = filters.searchTerm.toLowerCase();
            const filteredCoaches = allCoaches.filter(coach => 
                coach.name.toLowerCase().includes(lowerSearchTerm) ||
                (coach.bio && coach.bio.toLowerCase().includes(lowerSearchTerm)) ||
                coach.specialties.some(s => s.toLowerCase().includes(lowerSearchTerm)) ||
                coach.keywords.some(k => k.toLowerCase().includes(lowerSearchTerm))
            );
            console.log(`[getAllCoaches] Filtered to ${filteredCoaches.length} coaches with searchTerm: "${filters.searchTerm}"`);
            return filteredCoaches;
        }
        
        console.log(`[getAllCoaches] Returning ${allCoaches.length} coaches.`);
        return allCoaches;
    } catch (error) {
        console.error("[getAllCoaches] Error getting all coaches:", error);
        if ((error as any).code === 'permission-denied' || (error as any).code === 'failed-precondition') {
            console.error("[getAllCoaches] This is likely a Firestore Security Rule issue or a missing index.");
        }
        throw error; 
    }
}

export async function getCoachById(coachId: string): Promise<Coach | null> {
    try {
        const coachDocRef = doc(db, "users", coachId);
        const coachDoc = await getDoc(coachDocRef);

        if (coachDoc.exists() && coachDoc.data().role === 'coach') {
            return mapCoachFromFirestore(coachDoc.data(), coachDoc.id);
        } else {
            if (coachDoc.exists()) {
              console.warn(`[getCoachById] Document ${coachId} exists but role is not 'coach':`, coachDoc.data().role);
            } else {
              console.warn(`[getCoachById] Document ${coachId} does not exist.`);
            }
            return null;
        }
    } catch (error) {
        console.error(`[getCoachById] Error getting coach by ID ${coachId}:`, error);
        throw error;
    }
}


export async function getAllCoachIds(): Promise<string[]> {
    try {
        const q = query(collection(db, "users"), where("role", "==", "coach"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docSnapshot => docSnapshot.id);
    } catch (error) {
        console.error("[getAllCoachIds] Error getting all coach IDs:", error);
        return []; 
    }
}

export async function getAllPublishedBlogPostSlugs(): Promise<string[]> {
    try {
        const q = query(collection(db, "blogs"), where("status", "==", "published"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docSnapshot => (docSnapshot.data() as FirestoreBlogPost).slug);
    } catch (error) {
        console.error("[getAllPublishedBlogPostSlugs] Error getting all published blog post slugs:", error);
        return []; 
    }
}

export async function getFeaturedCoaches(count = 3): Promise<Coach[]> {
  console.log("[getFeaturedCoaches] Attempting to fetch featured coaches...");
  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", "coach"), 
      orderBy("name"), 
      firestoreLimit(count)
    );
    console.log("[getFeaturedCoaches] Executing query:", q);
    const querySnapshot = await getDocs(q);
    console.log(`[getFeaturedCoaches] Firestore query returned ${querySnapshot.docs.length} documents.`);
    
    const coaches = querySnapshot.docs.map(docSnapshot => {
      console.log(`[getFeaturedCoaches] Raw document data for ${docSnapshot.id}:`, docSnapshot.data());
      return mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
    });

    console.log(`[getFeaturedCoaches] Successfully fetched and mapped ${coaches.length} featured coaches.`);
    return coaches;
  } catch (error: any) {
    console.error("[getFeaturedCoaches] Error getting featured coaches:", error.code, error.message, error);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
        console.error("[getFeaturedCoaches] This is likely a Firestore Security Rule issue or a missing/incorrect index.");
    }
    // throw error; // Re-throw, or return empty array to prevent page crash
    return []; // Return empty array to prevent page crash for now
  }
}


export async function updateCoachSubscriptionTier(coachId: string, tier: 'free' | 'premium'): Promise<void> {
    try {
        const coachDocRef = doc(db, "users", coachId);
        await updateDoc(coachDocRef, {
            subscriptionTier: tier,
            updatedAt: serverTimestamp()
        });
        console.log(`[updateCoachSubscriptionTier] Coach ${coachId} subscription tier updated to ${tier}`);
    } catch (error) {
        console.error("[updateCoachSubscriptionTier] Error updating coach subscription tier:", error);
        throw error;
    }
}

export async function updateBlogPostStatus(postId: string, status: FirestoreBlogPost['status']): Promise<void> {
    try {
        const postDocRef = doc(db, "blogs", postId);
        await updateDoc(postDocRef, {
            status: status,
            updatedAt: serverTimestamp()
        });
        console.log(`[updateBlogPostStatus] Blog post ${postId} status updated to ${status}`);
    } catch (error) {
        console.error("[updateBlogPostStatus] Error updating blog post status:", error);
        throw error;
    }
}
