
import type { Timestamp } from "firebase/firestore";
import {
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs,
  serverTimestamp, limit as firestoreLimit, updateDoc, where, deleteDoc, writeBatch, runTransaction, collectionGroup,getCountFromServer
} from "firebase/firestore";
import { db } from "./firebase";
import type { FirestoreUserProfile, FirestoreBlogPost, Coach, BlogPost, UserRole, CoachStatus } from '@/types';

// Helper to convert Firestore Timestamps to ISO strings for a coach object
const mapCoachFromFirestore = (docData: any, id: string): Coach => {
  const data = docData as Omit<FirestoreUserProfile, 'id'> & { createdAt?: Timestamp, updatedAt?: Timestamp };
  console.log(`[mapCoachFromFirestore] Raw data for coach ${id}:`, JSON.stringify(data));
  return {
    id,
    name: data.name || 'Unnamed Coach',
    email: data.email, // email will be present from FirestoreUserProfile
    bio: data.bio || 'No bio available.',
    specialties: data.specialties || [],
    keywords: data.keywords || [],
    profileImageUrl: data.profileImageUrl === undefined ? null : data.profileImageUrl, // Ensure null if undefined
    dataAiHint: data.dataAiHint,
    certifications: data.certifications || [],
    socialLinks: data.socialLinks || [],
    location: data.location || undefined,
    subscriptionTier: data.subscriptionTier || 'free',
    websiteUrl: data.websiteUrl || undefined,
    introVideoUrl: data.introVideoUrl || undefined,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
    status: data.status || 'pending_approval',
    dataSource: 'Firestore',
  };
};

// Helper to convert Firestore Timestamps to ISO strings for a blog post object
const mapBlogPostFromFirestore = (docData: any, id: string): BlogPost => {
  const data = docData as Omit<FirestoreBlogPost, 'id'> & { createdAt: Timestamp, updatedAt?: Timestamp };
  return {
    id,
    slug: data.slug || id, // Fallback slug to id if not present
    title: data.title || 'Untitled Post',
    content: data.content || '',
    excerpt: data.excerpt || '', // Ensure excerpt is at least an empty string
    authorId: data.authorId || 'unknown_author',
    authorName: data.authorName || 'Unknown Author',
    createdAt: data.createdAt.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
    status: data.status || 'draft',
    tags: data.tags || [],
    featuredImageUrl: data.featuredImageUrl || undefined, // Ensure undefined if not present
    dataAiHint: data.dataAiHint,
  };
};


export async function setUserProfile(userId: string, profileData: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>>) {
  console.log(`[setUserProfile] Called for user: ${userId}`);
  console.log("[setUserProfile] Incoming profileData (original from auth.tsx or form):", JSON.stringify(profileData, null, 2));

  if (!userId) {
    console.error("[setUserProfile] CRITICAL: userId is undefined or null. Profile cannot be saved.");
    throw new Error("User ID is required to set user profile.");
  }
  
  const userDocRef = doc(db, "users", userId);
  
  try {
    const userSnap = await getDoc(userDocRef);
    const isCreating = !userSnap.exists();
    
    const dataToSet: { [key: string]: any } = {};

    // Fields from profileData (what the client/form sends)
    if (profileData.name !== undefined) dataToSet.name = profileData.name;
    if (isCreating && profileData.email !== undefined) dataToSet.email = profileData.email; // Email only on create
    if (isCreating && profileData.role !== undefined) dataToSet.role = profileData.role;       // Role only on create
    
    if (profileData.bio !== undefined) dataToSet.bio = profileData.bio;
    if (profileData.specialties !== undefined) dataToSet.specialties = profileData.specialties;
    if (profileData.keywords !== undefined) dataToSet.keywords = profileData.keywords;
    
    // Handle profileImageUrl: set to null if explicitly passed as null or an empty string from form, otherwise use value
    // For create, auth.tsx sends null if no photoURL. For update, form sends URL or null.
    if (profileData.hasOwnProperty('profileImageUrl')) {
      dataToSet.profileImageUrl = profileData.profileImageUrl || null;
    } else if (isCreating) {
      dataToSet.profileImageUrl = null; // Default to null on create if not provided by auth.tsx
    }
    
    if (profileData.certifications !== undefined) dataToSet.certifications = profileData.certifications;
    if (profileData.location !== undefined) dataToSet.location = profileData.location || null;
    if (profileData.websiteUrl !== undefined) dataToSet.websiteUrl = profileData.websiteUrl || null;
    if (profileData.introVideoUrl !== undefined) dataToSet.introVideoUrl = profileData.introVideoUrl || null;
    if (profileData.socialLinks !== undefined) dataToSet.socialLinks = profileData.socialLinks;
    
    if (profileData.subscriptionTier !== undefined) dataToSet.subscriptionTier = profileData.subscriptionTier;
    if (profileData.status !== undefined) dataToSet.status = profileData.status;
    
    // Timestamps
    dataToSet.updatedAt = serverTimestamp();
    if (isCreating) {
      dataToSet.createdAt = serverTimestamp();
      // Set initial status and subscriptionTier for new coaches if not explicitly in profileData (though auth.tsx should send them)
      if (dataToSet.role === 'coach') {
        if (dataToSet.subscriptionTier === undefined) dataToSet.subscriptionTier = 'free';
        if (dataToSet.status === undefined) dataToSet.status = 'pending_approval';
      }
    }
    
    console.log(`[setUserProfile] FINAL data object for ${isCreating ? 'setDoc (new)' : 'setDoc (merge)'} on /users/${userId}:`, JSON.stringify(dataToSet, null, 2));
    
    // Use setDoc with merge: true for updates, and setDoc without merge for creation (to ensure all fields are set initially)
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


export async function createFirestoreBlogPost(postData: Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'updatedAt' | 'slug'> & { slug?: string }): Promise<string> {
  try {
    const blogsCollection = collection(db, "blogs");
    const slug = postData.slug || (postData.title ? postData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') : `post-${Date.now()}`);
    
    const dataWithTimestampsAndSlug = {
      ...postData,
      slug: slug,
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp(),
      tags: postData.tags || [],
      featuredImageUrl: postData.featuredImageUrl || null, // Store null if empty/undefined
      excerpt: postData.excerpt || '',
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
    const dataToUpdate: Partial<FirestoreBlogPost> & {updatedAt: any} = { 
      ...postData,
      updatedAt: serverTimestamp()
    };
     if (postData.tags && typeof postData.tags === 'string') {
        dataToUpdate.tags = (postData.tags as string).split(',').map(tag => tag.trim()).filter(Boolean);
    } else if (Array.isArray(postData.tags)) {
        dataToUpdate.tags = postData.tags.map(tag => tag.trim()).filter(Boolean);
    } else if (postData.tags === undefined) {
        delete dataToUpdate.tags;
    }

    if (postData.featuredImageUrl === undefined) delete dataToUpdate.featuredImageUrl;
    else dataToUpdate.featuredImageUrl = postData.featuredImageUrl || null;

    if (postData.excerpt === undefined) delete dataToUpdate.excerpt;
    else dataToUpdate.excerpt = postData.excerpt || '';


    console.log(`[updateFirestoreBlogPost] Attempting to update blog post ${postId} with data:`, JSON.stringify(dataToUpdate, null, 2));
    await updateDoc(postDocRef, dataToUpdate);
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
      where("status", "==", "published"), // Only fetch published posts for public display
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

export async function getAllCoaches(filters?: { searchTerm?: string, includeAllStatuses?: boolean }): Promise<Coach[]> {
  console.log("[getAllCoaches] Fetching coaches. Filters:", JSON.stringify(filters) || "None");
  try {
    let coachesCollQuery = query(
      collection(db, "users"),
      where("role", "==", "coach")
    );

    if (!filters?.includeAllStatuses) {
      coachesCollQuery = query(coachesCollQuery, where("status", "==", "approved"));
    }
    
    coachesCollQuery = query(coachesCollQuery, orderBy("name", "asc"), firestoreLimit(50));


    console.log("[getAllCoaches] Executing query to Firestore for coaches.");
    const querySnapshot = await getDocs(coachesCollQuery);
    console.log(`[getAllCoaches] Firestore query returned ${querySnapshot.docs.length} coaches matching role (and status if applicable).`);
    
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
      console.error("[getAllCoaches] This is likely a Firestore Security Rule issue or a missing/incorrect index.");
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
      orderBy("name", "asc"), 
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
  console.log(`[getAllBlogPostsForAdmin] Fetching up to ${count} blog posts for admin view (all statuses).`);
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

// Firestore function to get messages for a user
// A more complex implementation would involve listening for real-time updates
export async function getMessagesForUser(userId: string): Promise<any[]> { // Using 'any' for now for message type
  console.log(`[getMessagesForUser] Fetching messages for user: ${userId}`);
  if (!userId) return [];
  try {
    const messagesRef = collection(db, "messages");
    // Query for messages where the user is either the sender or receiver
    const qSender = query(messagesRef, where("senderId", "==", userId), orderBy("timestamp", "desc"), firestoreLimit(20));
    const qReceiver = query(messagesRef, where("receiverId", "==", userId), orderBy("timestamp", "desc"), firestoreLimit(20));

    const [senderSnapshot, receiverSnapshot] = await Promise.all([
      getDocs(qSender),
      getDocs(qReceiver)
    ]);

    const messages: any[] = [];
    senderSnapshot.forEach(doc => messages.push({ id: doc.id, ...doc.data() }));
    receiverSnapshot.forEach(doc => {
      // Avoid duplicates if user sent message to themselves (edge case)
      if (!messages.find(m => m.id === doc.id)) {
        messages.push({ id: doc.id, ...doc.data() });
      }
    });

    // Sort all messages by timestamp
    messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // In a real app, you'd map this to your Message type, converting Firestore timestamps
    console.log(`[getMessagesForUser] Fetched ${messages.length} messages for user ${userId}`);
    return messages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp?.toDate ? msg.timestamp.toDate().toISOString() : new Date(msg.timestamp).toISOString() // Handle both Timestamp and string
    }));
  } catch (error) {
    console.error(`[getMessagesForUser] Error fetching messages for user ${userId}:`, error);
    return [];
  }
}


// Functions for Admin Dashboard Stats (Basic Implementations)
export async function getPendingCoachCount(): Promise<number> {
  try {
    const q = query(collection(db, "users"), where("role", "==", "coach"), where("status", "==", "pending_approval"));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (e) { console.error("Error getPendingCoachCount: ", e); return 0; }
}

export async function getPendingBlogPostCount(): Promise<number> {
  try {
    const q = query(collection(db, "blogs"), where("status", "==", "pending_approval"));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (e) { console.error("Error getPendingBlogPostCount: ", e); return 0; }
}

export async function getTotalUserCount(): Promise<number> {
 try {
    const q = query(collection(db, "users")); // Counts all documents in users
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (e) { console.error("Error getTotalUserCount: ", e); return 0; }
}

export async function getTotalCoachCount(): Promise<number> {
  try {
    const q = query(collection(db, "users"), where("role", "==", "coach"));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (e) { console.error("Error getTotalCoachCount: ", e); return 0; }
}


// Functions for Coach Dashboard Stats
export async function getCoachBlogStats(authorId: string): Promise<{ pending: number, published: number }> {
    if (!authorId) return { pending: 0, published: 0};
    try {
        const blogsCollection = collection(db, "blogs");
        const pendingQuery = query(blogsCollection, where("authorId", "==", authorId), where("status", "in", ["draft", "pending_approval"]));
        const publishedQuery = query(blogsCollection, where("authorId", "==", authorId), where("status", "==", "published"));

        const [pendingSnapshot, publishedSnapshot] = await Promise.all([
            getCountFromServer(pendingQuery),
            getCountFromServer(publishedQuery)
        ]);
        return {
            pending: pendingSnapshot.data().count,
            published: publishedSnapshot.data().count
        };
    } catch (error) {
        console.error(`Error getting blog stats for coach ${authorId}:`, error);
        return { pending: 0, published: 0 };
    }
}

export async function getCoachUnreadMessageCount(coachId: string): Promise<number> {
    if (!coachId) return 0;
    try {
        const messagesCollection = collection(db, "messages");
        const q = query(messagesCollection, where("receiverId", "==", coachId), where("read", "==", false));
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    } catch (error) {
        console.error(`Error getting unread message count for coach ${coachId}:`, error);
        return 0;
    }
}
