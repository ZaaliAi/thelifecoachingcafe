
// src/lib/firestore.ts
import type { Timestamp } from "firebase/firestore";
import { 
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs, 
  serverTimestamp, limit as firestoreLimit, updateDoc, where, writeBatch, collectionGroup
} from "firebase/firestore";
import { db, firebaseConfig } from "./firebase"; // Ensure firebaseConfig is exported if used directly elsewhere
import type { Coach, BlogPost, FirestoreUserProfile, FirestoreBlogPost, User } from '@/types';

// Helper to convert Firestore Timestamps to ISO strings for a coach object
const mapCoachFromFirestore = (docData: any, id: string): Coach => {
  const data = docData as Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: Timestamp, updatedAt?: Timestamp };
  return {
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
    status: data.status, // Include status if it's part of FirestoreUserProfile
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
    console.error("[setUserProfile] CRITICAL: userId is undefined or null. Profile cannot be saved.");
    throw new Error("User ID is required to set user profile.");
  }
  if (profileData.email === undefined && !('email' in profileData) ) { // Check if email is truly missing, not just null
    console.error(`[setUserProfile] CRITICAL: Attempting to set user profile for ${userId} WITHOUT an email field. This is likely an error in the calling code.`);
    // Depending on your rules, this might fail or lead to inconsistent data.
    // For now, we'll proceed but this should be investigated if it happens.
  }


  const userDocRef = doc(db, "users", userId);
  let dataToSet: { [key: string]: any } = {};

  // Populate dataToSet carefully, ensuring no undefined values are sent
  // For initial creation, certain fields are expected by rules.
  // For updates, only provided fields should be included in the merge.

  if (profileData.name !== undefined) dataToSet.name = profileData.name;
  // Email and role are usually set at creation and immutable by user update.
  // They should be present in profileData for CREATE operations.
  if (profileData.email !== undefined) dataToSet.email = profileData.email;
  if (profileData.role !== undefined) dataToSet.role = profileData.role;

  if (profileData.bio !== undefined) dataToSet.bio = profileData.bio;
  if (profileData.specialties !== undefined) dataToSet.specialties = profileData.specialties;
  if (profileData.keywords !== undefined) dataToSet.keywords = profileData.keywords;
  
  // Handle profileImageUrl: set to null if explicitly cleared or undefined
  dataToSet.profileImageUrl = profileData.profileImageUrl === undefined ? null : profileData.profileImageUrl;
  
  if (profileData.certifications !== undefined) dataToSet.certifications = profileData.certifications;
  if (profileData.location !== undefined) dataToSet.location = profileData.location || null;
  if (profileData.websiteUrl !== undefined) dataToSet.websiteUrl = profileData.websiteUrl || null;
  if (profileData.introVideoUrl !== undefined) dataToSet.introVideoUrl = profileData.introVideoUrl || null;
  if (profileData.socialLinks !== undefined) dataToSet.socialLinks = profileData.socialLinks;
  
  // Handle subscriptionTier carefully based on role and if it's a new document
  const userSnap = await getDoc(userDocRef); // Check if doc exists for create/update logic
  if (!userSnap.exists()) { // This is a CREATE operation
    dataToSet.createdAt = serverTimestamp();
    dataToSet.updatedAt = serverTimestamp();
    if (profileData.role === 'coach') {
      dataToSet.subscriptionTier = profileData.subscriptionTier !== undefined ? profileData.subscriptionTier : 'free';
    } else {
      // For 'user' or 'admin', subscriptionTier should not be set unless explicitly provided (which it isn't by auth.tsx)
      if (profileData.subscriptionTier !== undefined) { // Should not happen for user/admin from auth.tsx
         dataToSet.subscriptionTier = profileData.subscriptionTier;
      }
    }
  } else { // This is an UPDATE operation
    dataToSet.updatedAt = serverTimestamp();
    // For updates, only include subscriptionTier if it's explicitly in profileData
    // (typically only admins would send this for an update)
    if (profileData.subscriptionTier !== undefined) {
      dataToSet.subscriptionTier = profileData.subscriptionTier;
    }
  }
  if (profileData.status !== undefined) dataToSet.status = profileData.status;


  console.log("[setUserProfile] FINAL data object for setDoc/updateDoc on /users/", userId, ":", JSON.stringify(dataToSet, null, 2));

  try {
    if (!userSnap.exists()) {
      // Ensure required fields for CREATE according to rules are present
      if (!dataToSet.name || !dataToSet.email || !dataToSet.role || !dataToSet.createdAt || !dataToSet.updatedAt) {
        console.error(`[setUserProfile] CRITICAL for CREATE: Missing essential fields for user ${userId}. Data:`, dataToSet);
        throw new Error(`Cannot create user ${userId} due to missing essential fields (name, email, role, timestamps).`);
      }
      if (dataToSet.role === 'coach' && dataToSet.subscriptionTier === undefined) {
        console.warn(`[setUserProfile] CRITICAL for CREATE coach: subscriptionTier is undefined for coach ${userId}. Defaulting to 'free'. Data:`, dataToSet);
        dataToSet.subscriptionTier = 'free'; // Ensure default
      }
      await setDoc(userDocRef, dataToSet); // Not merging on create
    } else {
      await updateDoc(userDocRef, dataToSet); // Merging for updates
    }
    console.log(`[setUserProfile] User profile data written successfully for user: ${userId}`);
  } catch (error) {
    console.error(`[setUserProfile] Error creating/updating user profile for ${userId}:`, error);
    throw error;
  }
}


export async function getUserProfile(userId: string): Promise<(FirestoreUserProfile & {id: string}) | null> {
  console.log(`[getUserProfile] Fetching profile for user: ${userId}`);
  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      console.log(`[getUserProfile] Profile found for user ${userId}. Data:`, userDoc.data());
      const data = userDoc.data() as FirestoreUserProfile; // Assume data matches the type
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
        // TEMPORARY DEBUG: Remove orderBy to simplify query and reduce index dependency for permission testing
        const coachesQuery = query(
            collection(db, "users"), 
            where("role", "==", "coach"), 
            // orderBy("name", "asc") // Temporarily commented out for debugging
            firestoreLimit(50) // Added a limit to avoid fetching too many in tests
        );
        
        console.log("[getAllCoaches] Executing simplified query to Firestore...");
        const querySnapshot = await getDocs(coachesQuery);
        console.log(`[getAllCoaches] Firestore query returned ${querySnapshot.docs.length} documents with role 'coach'.`);

        let allCoaches = querySnapshot.docs.map(docSnapshot => {
          return mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
        });
        
        // Manually sort by name if orderBy was removed from query
        allCoaches.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

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
    } catch (error: any) {
        console.error("[getAllCoaches] Error getting all coaches:", error.code, error.message, error);
        if ((error as any).code === 'permission-denied' || (error as any).code === 'failed-precondition') {
            console.error("[getAllCoaches] This is likely a Firestore Security Rule issue or a missing/incorrect index (if orderBy was active). Ensure data has role: 'coach'.");
        }
        return []; // Return empty array to prevent page crash
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
    // TEMPORARY DEBUG: Remove orderBy to simplify query and reduce index dependency for permission testing
    const q = query(
      collection(db, "users"),
      where("role", "==", "coach"), 
      // orderBy("name"), // Temporarily commented out for debugging permission issue
      firestoreLimit(count)
    );
    console.log("[getFeaturedCoaches] Executing simplified query:", q);
    const querySnapshot = await getDocs(q);
    console.log(`[getFeaturedCoaches] Firestore query returned ${querySnapshot.docs.length} documents.`);
    
    const coaches = querySnapshot.docs.map(docSnapshot => {
      console.log(`[getFeaturedCoaches] Raw document data for ${docSnapshot.id}:`, docSnapshot.data());
      return mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
    });
    
    // Manually sort by name if orderBy was removed from query
    coaches.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    console.log(`[getFeaturedCoaches] Successfully fetched and mapped ${coaches.length} featured coaches.`);
    return coaches;
  } catch (error: any) {
    console.error("[getFeaturedCoaches] Error getting featured coaches:", error.code, error.message, error);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
        console.error("[getFeaturedCoaches] This is likely a Firestore Security Rule issue or a missing/incorrect index (if orderBy was active). Ensure data has role: 'coach'.");
    }
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
