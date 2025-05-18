
import type { Timestamp } from "firebase/firestore";
import {
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs,
  serverTimestamp, limit as firestoreLimit, updateDoc, where, deleteDoc
} from "firebase/firestore";
import { db } from "./firebase";
import type { FirestoreUserProfile, FirestoreBlogPost, Coach, BlogPost, UserRole, CoachStatus } from '@/types';

// Helper to convert Firestore Timestamps to ISO strings for a coach object
const mapCoachFromFirestore = (docData: any, id: string): Coach => {
  const data = docData as Omit<FirestoreUserProfile, 'id'> & { createdAt?: Timestamp, updatedAt?: Timestamp };
  console.log(`[mapCoachFromFirestore] Mapping data for coach ${id}:`, data);
  return {
    id,
    name: data.name || 'Unnamed Coach',
    email: data.email,
    bio: data.bio || 'No bio available.',
    // role: data.role || 'coach', // Role is part of User, not directly on Coach display type usually
    specialties: data.specialties || [],
    keywords: data.keywords || [],
    profileImageUrl: data.profileImageUrl || undefined,
    dataAiHint: data.dataAiHint,
    certifications: data.certifications || [],
    socialLinks: data.socialLinks || [],
    location: data.location || undefined,
    // availability: data.availability, // Assuming availability is handled elsewhere or not displayed on card
    subscriptionTier: data.subscriptionTier || 'free',
    websiteUrl: data.websiteUrl || undefined,
    introVideoUrl: data.introVideoUrl || undefined,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
    status: data.status || 'pending_approval', // Default to pending if not set
    dataSource: 'Firestore',
  };
};

// Helper to convert Firestore Timestamps to ISO strings for a blog post object
const mapBlogPostFromFirestore = (docData: any, id: string): BlogPost => {
  const data = docData as Omit<FirestoreBlogPost, 'id'> & { createdAt: Timestamp, updatedAt?: Timestamp };
  return {
    id,
    slug: data.slug || id,
    title: data.title || 'Untitled Post',
    content: data.content || '',
    excerpt: data.excerpt,
    authorId: data.authorId || 'unknown_author',
    authorName: data.authorName || 'Unknown Author',
    createdAt: data.createdAt.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
    status: data.status || 'draft',
    tags: data.tags || [],
    featuredImageUrl: data.featuredImageUrl,
    dataAiHint: data.dataAiHint,
  };
};


export async function setUserProfile(userId: string, profileData: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>>) {
  console.log(`[setUserProfile] Called for user: ${userId}`);
  console.log("[setUserProfile] Incoming profileData (original):", JSON.stringify(profileData, null, 2));

  if (!userId) {
    console.error("[setUserProfile] CRITICAL: userId is undefined or null. Profile cannot be saved.");
    throw new Error("User ID is required to set user profile.");
  }
  
  const userDocRef = doc(db, "users", userId);
  
  try {
    const userSnap = await getDoc(userDocRef);
    const isCreating = !userSnap.exists();
    
    // Build the data object carefully
    const dataToSet: { [key: string]: any } = {};

    // Core fields that should be in profileData for create, or can be updated
    if (profileData.name !== undefined) dataToSet.name = profileData.name;
    if (profileData.email !== undefined) dataToSet.email = profileData.email; // Essential for create
    if (profileData.role !== undefined) dataToSet.role = profileData.role;     // Essential for create

    // Optional fields - only add if present in profileData
    if (profileData.bio !== undefined) dataToSet.bio = profileData.bio;
    if (profileData.specialties !== undefined) dataToSet.specialties = profileData.specialties;
    if (profileData.keywords !== undefined) dataToSet.keywords = profileData.keywords;
    
    // Handle profileImageUrl: set to null if explicitly passed as null or undefined, otherwise use value
    if (profileData.hasOwnProperty('profileImageUrl')) {
      dataToSet.profileImageUrl = profileData.profileImageUrl === undefined ? null : profileData.profileImageUrl;
    } else if (isCreating) {
      dataToSet.profileImageUrl = null; // Ensure it's set to null on create if not provided
    }
    
    if (profileData.certifications !== undefined) dataToSet.certifications = profileData.certifications;
    if (profileData.location !== undefined) dataToSet.location = profileData.location;
    if (profileData.websiteUrl !== undefined) dataToSet.websiteUrl = profileData.websiteUrl;
    if (profileData.introVideoUrl !== undefined) dataToSet.introVideoUrl = profileData.introVideoUrl;
    if (profileData.socialLinks !== undefined) dataToSet.socialLinks = profileData.socialLinks;
    
    // Handle subscriptionTier and status (especially for coaches)
    if (profileData.role === 'coach') {
      if (isCreating) {
        dataToSet.subscriptionTier = profileData.subscriptionTier || 'free';
        dataToSet.status = profileData.status || 'pending_approval';
      } else { // For updates
        if (profileData.subscriptionTier !== undefined) dataToSet.subscriptionTier = profileData.subscriptionTier; // Allow admin to update
        if (profileData.status !== undefined) dataToSet.status = profileData.status; // Allow admin to update
      }
    } else { // For 'user' or 'admin' roles, these fields might not be applicable or sent
        if (profileData.subscriptionTier !== undefined) dataToSet.subscriptionTier = profileData.subscriptionTier; // Could be for admin editing another admin
        if (profileData.status !== undefined) dataToSet.status = profileData.status; // For admin changing status
    }


    dataToSet.updatedAt = serverTimestamp();
    if (isCreating) {
      dataToSet.createdAt = serverTimestamp();
    }
    
    console.log(`[setUserProfile] FINAL data object for ${isCreating ? 'setDoc (new)' : 'setDoc (merge)'} on /users/${userId}:`, JSON.stringify(dataToSet, null, 2));
    
    await setDoc(userDocRef, dataToSet, { merge: !isCreating }); 
    
    console.log(`[setUserProfile] User profile data written successfully for user: ${userId}. Operation: ${isCreating ? 'CREATE' : 'UPDATE'}`);

  } catch (error) {
    console.error(`[setUserProfile] Error creating/updating user profile for ${userId}:`, error);
    console.error("[setUserProfile] Data that was attempted (original profileData arg):", JSON.stringify(profileData, null, 2)); 
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
      const data = userDoc.data() as Omit<FirestoreUserProfile, 'id'>;
      return { id: userDoc.id, ...data } as (FirestoreUserProfile & { id: string });
    } else {
      console.log(`[getUserProfile] No profile found for user ${userId}`);
      return null;
    }
  } catch (error) {
    console.error(`[getUserProfile] Error getting user profile for ${userId}:`, error);
    throw error;
  }
}

// ... create/update/get blog post functions remain the same ...

export async function createFirestoreBlogPost(postData: Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'updatedAt' | 'slug'> & { slug?: string }): Promise<string> {
  try {
    const blogsCollection = collection(db, "blogs");
    const slug = postData.slug || (postData.title ? postData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') : `post-${Date.now()}`);
    
    const dataWithTimestampsAndSlug: FirestoreBlogPost = {
      ...postData,
      slug: slug,
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp(),
      tags: postData.tags || [],
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
    const dataWithTimestamp: Partial<FirestoreBlogPost> & {updatedAt: any} = { 
      ...postData,
      updatedAt: serverTimestamp()
    };
     if (postData.tags && typeof postData.tags === 'string') {
        dataWithTimestamp.tags = (postData.tags as string).split(',').map(tag => tag.trim()).filter(Boolean);
    } else if (postData.tags === undefined) { // ensure tags field is not sent as undefined
        delete dataWithTimestamp.tags;
    }

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
    console.log(`[getPublishedBlogPosts] Fetched ${querySnapshot.docs.length} published posts.`);
    return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
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
    return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
  } catch (error: any) {
     console.error(`[getBlogPostsByAuthor] Error getting blog posts for author ${authorId}:`, error.code, error.message);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
        console.error("[getBlogPostsByAuthor] This is likely a Firestore Security Rule issue or a missing/incorrect index (blogs: authorId ASC, status ASC, createdAt DESC).");
    }
    return [];
  }
}

export async function getAllCoaches(filters?: { searchTerm?: string }): Promise<Coach[]> {
  console.log("[getAllCoaches] Fetching coaches. Filters:", JSON.stringify(filters) || "None");
  try {
    const coachesQuery = query(
      collection(db, "users"),
      where("role", "==", "coach"),
      where("status", "==", "approved"), // Only fetch approved coaches for public display
      orderBy("name", "asc"), 
      firestoreLimit(50) 
    );

    console.log("[getAllCoaches] Executing query to Firestore for approved coaches.");
    const querySnapshot = await getDocs(coachesQuery);
    console.log(`[getAllCoaches] Firestore query returned ${querySnapshot.docs.length} approved coaches.`);
    
    let allCoaches = querySnapshot.docs.map(docSnapshot => mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id));

    if (filters?.searchTerm) {
      const lowerSearchTerm = filters.searchTerm.toLowerCase();
      allCoaches = allCoaches.filter(coach =>
        coach.name.toLowerCase().includes(lowerSearchTerm) ||
        (coach.bio && coach.bio.toLowerCase().includes(lowerSearchTerm)) ||
        coach.specialties.some(s => s.toLowerCase().includes(lowerSearchTerm)) ||
        (coach.keywords && coach.keywords.some(k => k.toLowerCase().includes(lowerSearchTerm)))
      );
      console.log(`[getAllCoaches] Filtered to ${allCoaches.length} coaches with searchTerm: "${filters.searchTerm}"`);
    }

    console.log(`[getAllCoaches] Returning ${allCoaches.length} coaches.`);
    return allCoaches;
  } catch (error: any) {
    console.error("[getAllCoaches] Error getting all coaches:", error.code, error.message, error);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
      console.error("[getAllCoaches] This is likely a Firestore Security Rule issue or a missing/incorrect index (users: role ASC, status ASC, name ASC).");
    }
    return [];
  }
}

export async function getCoachById(coachId: string): Promise<Coach | null> {
  console.log(`[getCoachById] Fetching coach by ID: ${coachId}`);
  if (!coachId) {
      console.warn("[getCoachById] Called with invalid coachId");
      return null;
  }
  try {
    const coachDocRef = doc(db, "users", coachId);
    const coachDoc = await getDoc(coachDocRef);

    if (coachDoc.exists() && coachDoc.data().role === 'coach') {
      console.log(`[getCoachById] Document found for ${coachId}:`, coachDoc.data());
      // For public profile, only show if approved, unless fetched by admin/owner (handled by rules)
      // This client-side check is an additional layer or for contexts where rules might not apply directly before fetch
      if (coachDoc.data().status !== 'approved') {
        console.warn(`[getCoachById] Coach ${coachId} is not approved. Status: ${coachDoc.data().status}`);
        // Depending on desired behavior, you might return null or the coach data anyway and let rules handle public visibility
      }
      return mapCoachFromFirestore(coachDoc.data(), coachDoc.id);
    } else {
      console.warn(`[getCoachById] Document ${coachId} does not exist or is not a coach.`);
      return null;
    }
  } catch (error: any) {
    console.error(`[getCoachById] Error getting coach by ID ${coachId}:`, error.code, error.message);
    return null; 
  }
}


export async function getAllCoachIds(): Promise<string[]> {
  console.log("[getAllCoachIds] Fetching all approved coach IDs for static generation.");
  try {
    const q = query(collection(db, "users"), where("role", "==", "coach"), where("status", "==", "approved"));
    const querySnapshot = await getDocs(q);
    const ids = querySnapshot.docs.map(docSnapshot => docSnapshot.id);
    console.log(`[getAllCoachIds] Found ${ids.length} approved coach IDs.`);
    return ids;
  } catch (error) {
    console.error("[getAllCoachIds] Error getting all coach IDs:", error);
    return [];
  }
}

export async function getAllPublishedBlogPostSlugs(): Promise<string[]> {
  console.log("[getAllPublishedBlogPostSlugs] Fetching all published blog post slugs.");
  try {
    const q = query(collection(db, "blogs"), where("status", "==", "published"));
    const querySnapshot = await getDocs(q);
    const slugs = querySnapshot.docs.map(docSnapshot => (docSnapshot.data() as FirestoreBlogPost).slug).filter(Boolean);
    console.log(`[getAllPublishedBlogPostSlugs] Found ${slugs.length} published blog post slugs.`);
    return slugs;
  } catch (error) {
    console.error("[getAllPublishedBlogPostSlugs] Error getting all published blog post slugs:", error);
    return [];
  }
}

export async function getFeaturedCoaches(count = 3): Promise<Coach[]> {
  console.log(`[getFeaturedCoaches] Attempting to fetch ${count} approved featured coaches...`);
  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", "coach"),
      where("status", "==", "approved"), // Only show approved coaches
      orderBy("name", "asc"), // Or some other criteria for "featured"
      firestoreLimit(count)
    );
    console.log("[getFeaturedCoaches] Executing query to fetch featured coaches.");
    const querySnapshot = await getDocs(q);
    console.log(`[getFeaturedCoaches] Firestore query returned ${querySnapshot.docs.length} documents.`);

    const coaches = querySnapshot.docs.map(docSnapshot => mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id));

    console.log(`[getFeaturedCoaches] Successfully fetched and mapped ${coaches.length} featured coaches.`);
    return coaches;
  } catch (error: any) {
    console.error("[getFeaturedCoaches] Error getting featured coaches:", error.code, error.message, error);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
        console.error("[getFeaturedCoaches] This is likely a Firestore Security Rule issue or a missing/incorrect index (users: role ASC, status ASC, name ASC).");
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

export async function updateCoachStatus(coachId: string, status: CoachStatus): Promise<void> {
  console.log(`[updateCoachStatus] Updating coach ${coachId} to status: ${status}`);
  try {
    const coachDocRef = doc(db, "users", coachId);
    await updateDoc(coachDocRef, {
      status: status,
      updatedAt: serverTimestamp()
    });
    console.log(`[updateCoachStatus] Coach ${coachId} status updated to ${status}`);
  } catch (error) {
    console.error(`[updateCoachStatus] Error updating coach status for ${coachId}:`, error);
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

export async function deleteFirestoreBlogPost(postId: string): Promise<void> {
  console.log(`[deleteFirestoreBlogPost] Attempting to delete blog post: ${postId}`);
  try {
    const postDocRef = doc(db, "blogs", postId);
    await deleteDoc(postDocRef);
    console.log(`[deleteFirestoreBlogPost] Blog post ${postId} deleted successfully.`);
  } catch (error) {
    console.error(`[deleteFirestoreBlogPost] Error deleting blog post ${postId}:`, error);
    throw error;
  }
}

export async function getAllBlogPostsForAdmin(count = 50): Promise<BlogPost[]> {
  console.log(`[getAllBlogPostsForAdmin] Fetching up to ${count} blog posts for admin view.`);
  try {
    const blogsCollection = collection(db, "blogs");
    const q = query(
      blogsCollection,
      orderBy("createdAt", "desc"),
      firestoreLimit(count)
    );
    const querySnapshot = await getDocs(q);
    console.log(`[getAllBlogPostsForAdmin] Fetched ${querySnapshot.docs.length} posts.`);
    return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
  } catch (error) {
    console.error("[getAllBlogPostsForAdmin] Error getting all blog posts for admin:", error);
    return [];
  }
}

export async function getMyBlogPosts(authorId: string, count = 50): Promise<BlogPost[]> {
  console.log(`[getMyBlogPosts] Fetching ${count} posts for author: ${authorId} (all statuses).`);
  try {
    const blogsCollection = collection(db, "blogs");
    const q = query(
      blogsCollection,
      where("authorId", "==", authorId),
      orderBy("createdAt", "desc"),
      firestoreLimit(count)
    );
    const querySnapshot = await getDocs(q);
    console.log(`[getMyBlogPosts] Fetched ${querySnapshot.docs.length} posts for author ${authorId}.`);
    return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
  } catch (error: any) {
     console.error(`[getMyBlogPosts] Error getting blog posts for author ${authorId}:`, error.code, error.message);
    if (error.code === 'failed-precondition') { 
        console.error("[getMyBlogPosts] This is likely a missing/incorrect index for query on 'blogs' collection: (authorId ASC, createdAt DESC). Please create this index in Firestore.");
    }
    return [];
  }
}
