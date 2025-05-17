
// src/lib/firestore.ts
import type { Timestamp } from "firebase/firestore";
import { 
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs, 
  serverTimestamp, limit as firestoreLimit, updateDoc, where, writeBatch, collectionGroup
} from "firebase/firestore";
import { db } from "./firebase";
import type { Coach, BlogPost, UserRole, FirestoreUserProfile, FirestoreBlogPost } from '@/types'; // Ensure all types are imported

// Helper to convert Firestore Timestamps to ISO strings for a coach object
const mapCoachFromFirestore = (docData: any, id: string): Coach => {
  const data = docData as Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: Timestamp, updatedAt?: Timestamp };
  return {
    // ...data, // Spread existing data
    id,
    name: data.name || 'Unnamed Coach',
    email: data.email,
    bio: data.bio || 'No bio available.',
    role: data.role || 'coach',
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
    // dataSource: 'Firestore', // Already in BlogPost type if needed
  } as BlogPost;
};


export async function setUserProfile(userId: string, profileData: Partial<Omit<FirestoreUserProfile, 'id'>>) {
  if (!userId) {
    console.error("setUserProfile: userId is undefined or null.");
    throw new Error("User ID is required to set user profile.");
  }
  try {
    const userDocRef = doc(db, "users", userId);
    const userSnap = await getDoc(userDocRef);

    const dataToSet: any = { // Use 'any' temporarily for flexible field setting, but ensure type safety from caller
      ...profileData,
      updatedAt: serverTimestamp(),
    };

    if (!userSnap.exists() || !userSnap.data()?.createdAt) {
      dataToSet.createdAt = serverTimestamp();
    }
    
    console.log(`[setUserProfile] Attempting to write to /users/${userId} with data:`, JSON.stringify(dataToSet, null, 2));

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
      // Convert Timestamps to a structure the client expects if needed, or handle in component
      const data = userDoc.data() as FirestoreUserProfile; // Assume data matches
      return { id: userDoc.id, ...data };
    } else {
      console.log(`No profile found for user ${userId}`);
      return null;
    }
  } catch (error) {
    console.error("Error getting user profile:", error);
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

export async function updateFirestoreBlogPost(postId: string, postData: Partial<Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'authorId' | 'authorName'>>) {
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
    console.error("Error getting blog post:", error);
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
        console.error("Error getting blog post by slug:", error);
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
    console.log(`[getPublishedBlogPosts] Fetched ${querySnapshot.docs.length} posts.`);
    return querySnapshot.docs.map(doc => mapBlogPostFromFirestore(doc.data(), doc.id));
  } catch (error) {
    console.error("[getPublishedBlogPosts] Error getting published blog posts:", error);
    throw error; // Re-throw to allow calling function to handle UI
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
        console.error("Error getting blog posts by author:", error);
        throw error;
    }
}

export async function getAllCoaches(filters?: { searchTerm?: string }): Promise<Coach[]> {
    console.log("[getAllCoaches] Attempting to fetch coaches. Filters:", filters);
    try {
        let coachesQuery = query(collection(db, "users"), where("role", "==", "coach"), orderBy("name", "asc"));
        
        const querySnapshot = await getDocs(coachesQuery);
        const allCoaches = querySnapshot.docs.map(docSnapshot => mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id));
        console.log(`[getAllCoaches] Fetched ${allCoaches.length} total coaches from Firestore.`);

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
        
        return allCoaches;
    } catch (error) {
        console.error("[getAllCoaches] Error getting all coaches:", error);
        // If it's a permission error, it will be a FirebaseError
        if ((error as any).code === 'permission-denied' || (error as any).code === 'failed-precondition') {
            console.error("[getAllCoaches] This is likely a Firestore Security Rule issue or a missing index.");
        }
        throw error; // Re-throw to allow calling function to handle UI
    }
}

export async function getCoachById(coachId: string): Promise<Coach | null> {
    try {
        const coachDocRef = doc(db, "users", coachId);
        const coachDoc = await getDoc(coachDocRef);

        if (coachDoc.exists() && coachDoc.data().role === 'coach') {
            return mapCoachFromFirestore(coachDoc.data(), coachDoc.id);
        } else {
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
        console.error("Error getting all coach IDs:", error);
        throw []; // Return empty array on error
    }
}

export async function getAllPublishedBlogPostSlugs(): Promise<string[]> {
    try {
        const q = query(collection(db, "blogs"), where("status", "==", "published"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docSnapshot => (docSnapshot.data() as FirestoreBlogPost).slug);
    } catch (error) {
        console.error("Error getting all published blog post slugs:", error);
        throw []; // Return empty array on error
    }
}

export async function getFeaturedCoaches(count = 3): Promise<Coach[]> {
  console.log("[getFeaturedCoaches] Attempting to fetch featured coaches...");
  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", "coach"), // Ensure role is explicitly "coach"
      orderBy("name"), // Example ordering, could be by a "featured" flag or creation date
      firestoreLimit(count)
    );
    const querySnapshot = await getDocs(q);
    const coaches = querySnapshot.docs.map(docSnapshot => {
      console.log("[getFeaturedCoaches] Raw document data:", docSnapshot.id, docSnapshot.data());
      return mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
    });
    console.log(`[getFeaturedCoaches] Successfully fetched ${coaches.length} featured coaches.`);
    return coaches;
  } catch (error) {
    console.error("[getFeaturedCoaches] Error getting featured coaches:", error);
    if ((error as any).code === 'permission-denied' || (error as any).code === 'failed-precondition') {
        console.error("[getFeaturedCoaches] This is likely a Firestore Security Rule issue or a missing index.");
    }
    throw error; // Re-throw to allow calling function to handle UI
  }
}


export async function updateCoachSubscriptionTier(coachId: string, tier: 'free' | 'premium'): Promise<void> {
    try {
        const coachDocRef = doc(db, "users", coachId);
        await updateDoc(coachDocRef, {
            subscriptionTier: tier,
            updatedAt: serverTimestamp()
        });
        console.log(`Coach ${coachId} subscription tier updated to ${tier}`);
    } catch (error) {
        console.error("Error updating coach subscription tier:", error);
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
        console.log(`Blog post ${postId} status updated to ${status}`);
    } catch (error) {
        console.error("Error updating blog post status:", error);
        throw error;
    }
}

    