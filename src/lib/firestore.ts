
// src/lib/firestore.ts
import type { Timestamp } from "firebase/firestore";
import {
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs,
  serverTimestamp, limit as firestoreLimit, updateDoc, where, writeBatch, collectionGroup
} from "firebase/firestore";
import { db } from "./firebase";
import type { FirestoreUserProfile, FirestoreBlogPost, Coach, BlogPost, UserRole } from '@/types';

// Helper to convert Firestore Timestamps to ISO strings for a coach object
const mapCoachFromFirestore = (docData: any, id: string): Coach => {
  const data = docData as Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'> & { createdAt?: Timestamp, updatedAt?: Timestamp };
  const coachData: Coach = {
    id,
    name: data.name || 'Unnamed Coach',
    email: data.email,
    bio: data.bio || 'No bio available.',
    role: data.role || 'coach',
    specialties: data.specialties || [],
    keywords: data.keywords || [],
    profileImageUrl: data.profileImageUrl === undefined ? undefined : (data.profileImageUrl || undefined),
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


export async function setUserProfile(userId: string, profileData: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>>) {
  console.log("[setUserProfile] Called for user:", userId);
  console.log("[setUserProfile] Incoming profileData from caller (e.g. auth.tsx or profile form):", JSON.stringify(profileData, null, 2));

  if (!userId) {
    console.error("[setUserProfile] CRITICAL: userId is undefined or null. Profile cannot be saved.");
    throw new Error("User ID is required to set user profile.");
  }
  
  const userDocRef = doc(db, "users", userId);
  
  try {
    const userSnap = await getDoc(userDocRef);
    const isCreating = !userSnap.exists();
    
    // Initialize dataToSet with fields that should always be present or updated
    const dataToSet: { [key: string]: any } = {
      updatedAt: serverTimestamp(),
    };
    if (isCreating) {
      dataToSet.createdAt = serverTimestamp();
    }

    // Explicitly add fields from profileData if they are defined.
    // This avoids accidentally sending `undefined` values for fields not included in profileData.
    if (profileData.name !== undefined) dataToSet.name = profileData.name;
    else if (isCreating) throw new Error("Name is required for new user profile creation.");
    
    if (profileData.email !== undefined) dataToSet.email = profileData.email;
    else if (isCreating) throw new Error("Email is required for new user profile creation.");

    if (profileData.role !== undefined) dataToSet.role = profileData.role;
    else if (isCreating) throw new Error("Role is required for new user profile creation.");

    // Handle profileImageUrl:
    // - On create: If profileData contains profileImageUrl (even if null), it will be included.
    //   If auth.tsx no longer sends profileImageUrl in profileData for new users, it won't be in dataToSet.
    // - On update: If profileData contains profileImageUrl (can be string or null), it will be included.
    if (profileData.hasOwnProperty('profileImageUrl')) {
      dataToSet.profileImageUrl = profileData.profileImageUrl; // This can be null
    }

    // Handle subscriptionTier:
    // - On create: If profileData from auth.tsx has it (e.g., 'free' for coaches), it's included.
    //   If auth.tsx omits it (e.g., for users), it won't be in dataToSet from this check.
    // - On update: If profileData from profile form has it, it's included.
    if (profileData.hasOwnProperty('subscriptionTier')) {
      dataToSet.subscriptionTier = profileData.subscriptionTier;
    } else if (isCreating && profileData.role === 'coach') {
      // If creating a coach and subscriptionTier wasn't in profileData, default it.
      dataToSet.subscriptionTier = 'free';
    }
    
    // For updates, include any other optional fields passed in profileData
    if (!isCreating) {
      if (profileData.bio !== undefined) dataToSet.bio = profileData.bio;
      if (profileData.specialties !== undefined) dataToSet.specialties = profileData.specialties;
      if (profileData.keywords !== undefined) dataToSet.keywords = profileData.keywords;
      if (profileData.certifications !== undefined) dataToSet.certifications = profileData.certifications;
      if (profileData.location !== undefined) dataToSet.location = profileData.location;
      if (profileData.websiteUrl !== undefined) dataToSet.websiteUrl = profileData.websiteUrl;
      if (profileData.introVideoUrl !== undefined) dataToSet.introVideoUrl = profileData.introVideoUrl;
      if (profileData.socialLinks !== undefined) dataToSet.socialLinks = profileData.socialLinks;
    }


    console.log(`[setUserProfile] FINAL data object for ${isCreating ? 'setDoc (new)' : 'setDoc (merge)'} on /users/${userId}:`, JSON.stringify(dataToSet, null, 2));
    
    // For a new document, setDoc without merge ensures all fields must pass rule validation.
    // For an existing document, setDoc with merge:true updates only provided fields.
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

export async function createFirestoreBlogPost(postData: Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'updatedAt' | 'slug'> & { slug?: string }): Promise<string> {
  try {
    const blogsCollection = collection(db, "blogs");
    const slug = postData.slug || (postData.title ? postData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') : `post-${Date.now()}`);
    
    const dataWithTimestampsAndSlug: FirestoreBlogPost = {
      ...postData,
      authorId: postData.authorId, 
      authorName: postData.authorName,
      title: postData.title,
      content: postData.content,
      status: postData.status,
      slug: slug,
      createdAt: serverTimestamp() as any, 
      updatedAt: serverTimestamp() as any,
      tags: postData.tags || [],
      excerpt: postData.excerpt || '',
      featuredImageUrl: postData.featuredImageUrl || '',
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
     console.error(`[getBlogPostsByAuthor] Error getting blog posts for author ${authorId}:`, error.code, error.message);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
        console.error("[getBlogPostsByAuthor] This is likely a Firestore Security Rule issue or a missing/incorrect index for query on 'blogs' collection: (authorId == ${authorId} AND status == 'published' ORDER BY createdAt DESC). Ensure the index (blogs: authorId ASC, status ASC, createdAt DESC) is built and enabled.");
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

    console.log("[getAllCoaches] Executing query to Firestore for all coaches.");
    const querySnapshot = await getDocs(coachesQuery);
    console.log(`[getAllCoaches] Firestore query returned ${querySnapshot.docs.length} documents with role 'coach'.`);
    querySnapshot.forEach(doc => {
      console.log(`[getAllCoaches] Coach data from Firestore: ${doc.id}`, doc.data());
    });


    let allCoaches = querySnapshot.docs.map(docSnapshot => {
      return mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
    });

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
    console.error("[getAllCoaches] Error getting all coaches:", error.code, error.message);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
      console.error("[getAllCoaches] This is likely a Firestore Security Rule issue or a missing/incorrect index for query on 'users' collection: (role == 'coach' ORDER BY name ASC). Ensure the index (users: role ASC, name ASC) is built and enabled.");
    }
    return [];
  }
}

export async function getCoachById(coachId: string): Promise<Coach | null> {
  console.log(`[getCoachById] Fetching coach by ID: ${coachId}`);
  try {
    const coachDocRef = doc(db, "users", coachId);
    const coachDoc = await getDoc(coachDocRef);

    if (coachDoc.exists()) {
      console.log(`[getCoachById] Document found for ${coachId}:`, coachDoc.data());
      if (coachDoc.data().role === 'coach') {
         return mapCoachFromFirestore(coachDoc.data(), coachDoc.id);
      } else {
        console.warn(`[getCoachById] Document ${coachId} exists but role is not 'coach':`, coachDoc.data().role);
        return null;
      }
    } else {
      console.warn(`[getCoachById] Document ${coachId} does not exist.`);
      return null;
    }
  } catch (error: any) {
    console.error(`[getCoachById] Error getting coach by ID ${coachId}:`, error.code, error.message);
     if (error.code === 'permission-denied') {
        console.error(`[getCoachById] Firestore Security Rule issue trying to read /users/${coachId}.`);
    }
    return null; 
  }
}


export async function getAllCoachIds(): Promise<string[]> {
  console.log("[getAllCoachIds] Fetching all coach IDs.");
  try {
    const q = query(collection(db, "users"), where("role", "==", "coach"));
    const querySnapshot = await getDocs(q);
    const ids = querySnapshot.docs.map(docSnapshot => docSnapshot.id);
    console.log(`[getAllCoachIds] Found ${ids.length} coach IDs.`);
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
  console.log(`[getFeaturedCoaches] Attempting to fetch ${count} featured coaches...`);
  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", "coach"),
      orderBy("name", "asc"), 
      firestoreLimit(count)
    );
    console.log("[getFeaturedCoaches] Executing query to fetch featured coaches.");
    const querySnapshot = await getDocs(q);
    console.log(`[getFeaturedCoaches] Firestore query returned ${querySnapshot.docs.length} documents.`);

    const coaches = querySnapshot.docs.map(docSnapshot => {
      console.log(`[getFeaturedCoaches] Raw document data for ${docSnapshot.id}:`, JSON.stringify(docSnapshot.data(), null, 2));
      return mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
    });

    console.log(`[getFeaturedCoaches] Successfully fetched and mapped ${coaches.length} featured coaches.`);
    return coaches;
  } catch (error: any) {
    console.error("[getFeaturedCoaches] Error getting featured coaches:", error.code, error.message, error);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
        console.error("[getFeaturedCoaches] This is likely a Firestore Security Rule issue or a missing/incorrect index for query (users: role ASC, name ASC).");
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
