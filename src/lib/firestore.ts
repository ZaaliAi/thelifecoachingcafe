
// src/lib/firestore.ts
import type { Timestamp } from "firebase/firestore";
import {
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs,
  serverTimestamp, limit as firestoreLimit, updateDoc, where, writeBatch, collectionGroup
} from "firebase/firestore";
import { db } from "./firebase"; // firebaseConfig removed from here as it's directly in firebase.ts
import type { Coach, BlogPost, FirestoreUserProfile, FirestoreBlogPost } from '@/types';

// Helper to convert Firestore Timestamps to ISO strings for a coach object
const mapCoachFromFirestore = (docData: any, id: string): Coach => {
  const data = docData as Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: Timestamp, updatedAt?: Timestamp };
  const coachData: Coach = {
    id,
    name: data.name || 'Unnamed Coach',
    email: data.email, // email should exist
    bio: data.bio || 'No bio available.',
    role: data.role || 'coach', // Default to coach if role somehow missing on a coach doc
    specialties: data.specialties || [],
    keywords: data.keywords || [],
    profileImageUrl: data.profileImageUrl === undefined ? undefined : (data.profileImageUrl || undefined), // Ensure undefined if null/empty
    dataAiHint: data.dataAiHint,
    certifications: data.certifications || [],
    socialLinks: data.socialLinks || [],
    location: data.location || undefined,
    availability: data.availability,
    subscriptionTier: data.subscriptionTier || 'free',
    websiteUrl: data.websiteUrl || undefined,
    introVideoUrl: data.introVideoUrl || undefined,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
    status: data.status,
    dataSource: 'Firestore',
  };
  // console.log(`[mapCoachFromFirestore] Mapped coach ${id}:`, JSON.stringify(coachData, (key, value) => value === undefined ? null : value, 2));
  return coachData;
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
  console.log("[setUserProfile] Called for user:", userId, "with incoming profileData:", JSON.stringify(profileData, null, 2));
  if (!userId) {
    console.error("[setUserProfile] CRITICAL: userId is undefined or null. Profile cannot be saved.");
    throw new Error("User ID is required to set user profile.");
  }
  
  const userDocRef = doc(db, "users", userId);
  
  try {
    const userSnap = await getDoc(userDocRef);
    const isCreating = !userSnap.exists();
    
    let dataToSet: { [key: string]: any } = {};

    if (isCreating) {
      console.log(`[setUserProfile] Document for user ${userId} does not exist. Preparing for CREATE.`);
      // For CREATE, strictly use fields from profileData that are expected for initial setup
      if (profileData.name === undefined || profileData.email === undefined || profileData.role === undefined) {
        console.error(`[setUserProfile] CRITICAL for CREATE: Name, Email, or Role is missing for user ${userId}. ProfileData:`, profileData);
        throw new Error(`Cannot create user ${userId} due to missing essential fields (name, email, or role).`);
      }
      dataToSet.name = profileData.name;
      dataToSet.email = profileData.email;
      dataToSet.role = profileData.role;
      dataToSet.profileImageUrl = profileData.profileImageUrl !== undefined ? profileData.profileImageUrl : null; // Explicitly null if not provided
      
      if (profileData.role === 'coach') {
        dataToSet.subscriptionTier = profileData.subscriptionTier !== undefined ? profileData.subscriptionTier : 'free'; // Default to free for new coaches
      } else if (profileData.subscriptionTier !== undefined) {
        // If not a coach but subscriptionTier was passed, log a warning and don't set it (unless rule allows it)
        console.warn(`[setUserProfile] subscriptionTier was passed for non-coach role '${profileData.role}' for user ${userId}. It will not be set unless rules specifically allow.`);
        // If rules expect it to be null for user/admin, then:
        // dataToSet.subscriptionTier = null;
      }

      dataToSet.createdAt = serverTimestamp();
      dataToSet.updatedAt = serverTimestamp();
    } else {
      console.log(`[setUserProfile] Document for user ${userId} exists. Preparing for UPDATE.`);
      // For UPDATE, spread all provided profileData and add updatedAt
      // Ensure that fields not meant to be updated by users (like role, email from profile form) are not in profileData
      dataToSet = { ...profileData }; // Start with all updateable fields passed in
      // Ensure server timestamp for updatedAt
      dataToSet.updatedAt = serverTimestamp();
      // Remove createdAt from update payload if it was accidentally included
      if ('createdAt' in dataToSet) {
        delete dataToSet.createdAt;
      }
      // Ensure email and role are not part of typical profileData updates from user-facing forms
      if (profileData.email !== undefined && profileData.email !== userSnap.data()?.email) {
          console.warn(`[setUserProfile] Attempt to change email for user ${userId} during profile update. This is typically disallowed by rules for owners.`);
          // Retain original email if rule prevents change by owner
          dataToSet.email = userSnap.data()?.email;
      }
      if (profileData.role !== undefined && profileData.role !== userSnap.data()?.role) {
          console.warn(`[setUserProfile] Attempt to change role for user ${userId} during profile update. This is typically disallowed by rules for owners.`);
          // Retain original role if rule prevents change by owner
          dataToSet.role = userSnap.data()?.role;
      }
    }

    console.log("[setUserProfile] FINAL data object for setDoc on /users/", userId, ":", JSON.stringify(dataToSet, null, 2));
    await setDoc(userDocRef, dataToSet, { merge: !isCreating }); // Use merge:true for updates, merge:false (default) for strict create
    console.log(`[setUserProfile] User profile data written successfully for user: ${userId}. Operation: ${isCreating ? 'CREATE' : 'UPDATE'}`);

  } catch (error) {
    console.error(`[setUserProfile] Error creating/updating user profile for ${userId}:`, error);
    console.error("[setUserProfile] Data that was attempted:", JSON.stringify(profileData, null, 2)); // Log the original profileData for context
    throw error;
  }
}


export async function getUserProfile(userId: string): Promise<(FirestoreUserProfile & { id: string }) | null> {
  console.log(`[getUserProfile] Fetching profile for user: ${userId}`);
  if (!userId) {
    console.warn("[getUserProfile] Called with undefined or null userId.");
    return null;
  }
  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const data = userDoc.data() as FirestoreUserProfile; // Assuming data conforms to FirestoreUserProfile
      // console.log(`[getUserProfile] Profile found for user ${userId}. Data:`, JSON.stringify(data, null, 2));
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

export async function createFirestoreBlogPost(postData: Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'updatedAt' | 'slug'> & { slug?: string }): Promise<string> {
  try {
    const blogsCollection = collection(db, "blogs");
    const slug = postData.slug || (postData.title ? postData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') : `post-${Date.now()}`);
    const dataWithTimestampsAndSlug = {
      ...postData,
      slug: slug,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    console.log("[createFirestoreBlogPost] Attempting to create blog post with data:", JSON.stringify(dataWithTimestampsAndSlug, null, 2));
    const newPostRef = await addDoc(blogsCollection, dataWithTimestampsAndSlug);
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
  console.log(`[getFirestoreBlogPost] Fetching blog post by ID: ${postId}`);
  try {
    const postDocRef = doc(db, "blogs", postId);
    const postDoc = await getDoc(postDocRef);

    if (postDoc.exists()) {
      // console.log(`[getFirestoreBlogPost] Post found: ${postId}`);
      return mapBlogPostFromFirestore(postDoc.data(), postDoc.id);
    } else {
      console.warn(`[getFirestoreBlogPost] No post found with ID: ${postId}`);
      return null;
    }
  } catch (error) {
    console.error(`[getFirestoreBlogPost] Error getting blog post by ID ${postId}:`, error);
    throw error;
  }
}

export async function getFirestoreBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  console.log(`[getFirestoreBlogPostBySlug] Fetching blog post by slug: ${slug}`);
  try {
    const blogsCollection = collection(db, "blogs");
    const q = query(blogsCollection, where("slug", "==", slug), firestoreLimit(1));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const postDoc = querySnapshot.docs[0];
      // console.log(`[getFirestoreBlogPostBySlug] Post found for slug ${slug}: ID ${postDoc.id}`);
      return mapBlogPostFromFirestore(postDoc.data(), postDoc.id);
    } else {
      console.warn(`[getFirestoreBlogPostBySlug] No post found with slug: ${slug}`);
      return null;
    }
  } catch (error) {
    console.error(`[getFirestoreBlogPostBySlug] Error getting blog post by slug ${slug}:`, error);
    throw error;
  }
}

export async function getPublishedBlogPosts(count = 10): Promise<BlogPost[]> {
  console.log(`[getPublishedBlogPosts] Fetching ${count} published blog posts.`);
  try {
    const blogsCollection = collection(db, "blogs");
    const q = query(
      blogsCollection,
      where("status", "==", "published"),
      orderBy("createdAt", "desc"),
      firestoreLimit(count)
    );
    const querySnapshot = await getDocs(q);
    // console.log(`[getPublishedBlogPosts] Fetched ${querySnapshot.docs.length} published posts.`);
    return querySnapshot.docs.map(doc => mapBlogPostFromFirestore(doc.data(), doc.id));
  } catch (error) {
    console.error("[getPublishedBlogPosts] Error getting published blog posts:", error);
    return [];
  }
}

export async function getBlogPostsByAuthor(authorId: string, count = 10): Promise<BlogPost[]> {
  console.log(`[getBlogPostsByAuthor] Fetching ${count} published posts for author: ${authorId}`);
  try {
    const blogsCollection = collection(db, "blogs");
    const q = query(
      blogsCollection,
      where("authorId", "==", authorId),
      where("status", "==", "published"),
      orderBy("createdAt", "desc"),
      firestoreLimit(count)
    );
    const querySnapshot = await getDocs(q);
    console.log(`[getBlogPostsByAuthor] Fetched ${querySnapshot.docs.length} published posts for author ${authorId}.`);
    return querySnapshot.docs.map(doc => mapBlogPostFromFirestore(doc.data(), doc.id));
  } catch (error: any) {
     console.error(`[getBlogPostsByAuthor] Error getting blog posts by author ${authorId}:`, error.code, error.message, error);
     if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
        console.error("[getBlogPostsByAuthor] This is likely a Firestore Security Rule issue or a missing/incorrect index for query: (authorId == ${authorId} AND status == 'published' ORDER BY createdAt DESC).");
    }
    return [];
  }
}

export async function getAllCoaches(filters?: { searchTerm?: string }): Promise<Coach[]> {
  console.log("[getAllCoaches] Attempting to fetch coaches. Filters:", filters);
  try {
    const coachesQuery = query(
      collection(db, "users"),
      where("role", "==", "coach"),
      orderBy("name", "asc"), 
      firestoreLimit(50)
    );

    // console.log("[getAllCoaches] Executing query to Firestore for all coaches.");
    const querySnapshot = await getDocs(coachesQuery);
    console.log(`[getAllCoaches] Firestore query returned ${querySnapshot.docs.length} documents with role 'coach'.`);

    let allCoaches = querySnapshot.docs.map(docSnapshot => {
      return mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
    });

    if (filters?.searchTerm) {
      const lowerSearchTerm = filters.searchTerm.toLowerCase();
      allCoaches = allCoaches.filter(coach =>
        coach.name.toLowerCase().includes(lowerSearchTerm) ||
        (coach.bio && coach.bio.toLowerCase().includes(lowerSearchTerm)) ||
        coach.specialties.some(s => s.toLowerCase().includes(lowerSearchTerm)) ||
        coach.keywords.some(k => k.toLowerCase().includes(lowerSearchTerm))
      );
      console.log(`[getAllCoaches] Filtered to ${allCoaches.length} coaches with searchTerm: "${filters.searchTerm}"`);
    }

    console.log(`[getAllCoaches] Returning ${allCoaches.length} coaches.`);
    return allCoaches;
  } catch (error: any) {
    console.error("[getAllCoaches] Error getting all coaches:", error.code, error.message, error);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
      console.error("[getAllCoaches] This is likely a Firestore Security Rule issue or a missing/incorrect index for query: (role == 'coach' ORDER BY name ASC).");
    }
    return [];
  }
}

export async function getCoachById(coachId: string): Promise<Coach | null> {
  console.log(`[getCoachById] Fetching coach by ID: ${coachId}`);
  try {
    const coachDocRef = doc(db, "users", coachId);
    const coachDoc = await getDoc(coachDocRef);

    if (coachDoc.exists() && coachDoc.data().role === 'coach') {
      // console.log(`[getCoachById] Coach found: ${coachId}`);
      return mapCoachFromFirestore(coachDoc.data(), coachDoc.id);
    } else {
      if (coachDoc.exists()) {
        console.warn(`[getCoachById] Document ${coachId} exists but role is not 'coach':`, coachDoc.data().role);
      } else {
        console.warn(`[getCoachById] Document ${coachId} does not exist.`);
      }
      return null;
    }
  } catch (error: any) {
    console.error(`[getCoachById] Error getting coach by ID ${coachId}:`, error.code, error.message, error);
     if (error.code === 'permission-denied') {
        console.error(`[getCoachById] Firestore Security Rule issue trying to read /users/${coachId}.`);
    }
    throw error; // Re-throw to be caught by page if needed
  }
}


export async function getAllCoachIds(): Promise<string[]> {
  // console.log("[getAllCoachIds] Fetching all coach IDs.");
  try {
    const q = query(collection(db, "users"), where("role", "==", "coach"));
    const querySnapshot = await getDocs(q);
    const ids = querySnapshot.docs.map(docSnapshot => docSnapshot.id);
    // console.log(`[getAllCoachIds] Found ${ids.length} coach IDs.`);
    return ids;
  } catch (error) {
    console.error("[getAllCoachIds] Error getting all coach IDs:", error);
    return [];
  }
}

export async function getAllPublishedBlogPostSlugs(): Promise<string[]> {
  // console.log("[getAllPublishedBlogPostSlugs] Fetching all published blog post slugs.");
  try {
    const q = query(collection(db, "blogs"), where("status", "==", "published"));
    const querySnapshot = await getDocs(q);
    const slugs = querySnapshot.docs.map(docSnapshot => (docSnapshot.data() as FirestoreBlogPost).slug).filter(Boolean);
    // console.log(`[getAllPublishedBlogPostSlugs] Found ${slugs.length} published blog post slugs.`);
    return slugs;
  } catch (error) {
    console.error("[getAllPublishedBlogPostSlugs] Error getting all published blog post slugs:", error);
    return [];
  }
}

export async function getFeaturedCoaches(count = 3): Promise<Coach[]> {
  console.log(`[getFeaturedCoaches] Attempting to fetch ${count} featured coaches...`);
  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", "coach"),
      orderBy("name", "asc"), // Ensure index (role ASC, name ASC) exists
      firestoreLimit(count)
    );
    const querySnapshot = await getDocs(q);
    console.log(`[getFeaturedCoaches] Firestore query returned ${querySnapshot.docs.length} documents.`);

    const coaches = querySnapshot.docs.map(docSnapshot => {
      // console.log(`[getFeaturedCoaches] Raw document data for ${docSnapshot.id}:`, JSON.stringify(docSnapshot.data(), null, 2));
      return mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
    });

    console.log(`[getFeaturedCoaches] Successfully fetched and mapped ${coaches.length} featured coaches.`);
    return coaches;
  } catch (error: any) {
    console.error("[getFeaturedCoaches] Error getting featured coaches:", error.code, error.message, error);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
        console.error("[getFeaturedCoaches] This is likely a Firestore Security Rule issue or a missing/incorrect index for query (role == 'coach' ORDER BY name).");
    }
    return []; 
  }
}


export async function updateCoachSubscriptionTier(coachId: string, tier: 'free' | 'premium'): Promise<void> {
  console.log(`[updateCoachSubscriptionTier] Updating coach ${coachId} to tier: ${tier}`);
  try {
    const coachDocRef = doc(db, "users", coachId);
    await updateDoc(coachDocRef, {
      subscriptionTier: tier,
      updatedAt: serverTimestamp()
    });
    console.log(`[updateCoachSubscriptionTier] Coach ${coachId} subscription tier updated to ${tier}`);
  } catch (error) {
    console.error(`[updateCoachSubscriptionTier] Error updating coach subscription tier for ${coachId}:`, error);
    throw error;
  }
}

export async function updateBlogPostStatus(postId: string, status: FirestoreBlogPost['status']): Promise<void> {
  console.log(`[updateBlogPostStatus] Updating blog post ${postId} to status: ${status}`);
  try {
    const postDocRef = doc(db, "blogs", postId);
    await updateDoc(postDocRef, {
      status: status,
      updatedAt: serverTimestamp()
    });
    console.log(`[updateBlogPostStatus] Blog post ${postId} status updated to ${status}`);
  } catch (error) {
    console.error(`[updateBlogPostStatus] Error updating blog post status for ${postId}:`, error);
    throw error;
  }
}
