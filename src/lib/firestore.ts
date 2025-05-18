
import type { Timestamp } from "firebase/firestore";
import {
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs,
  serverTimestamp, limit as firestoreLimit, updateDoc, where, deleteDoc, writeBatch, runTransaction, collectionGroup, getCountFromServer
} from "firebase/firestore";
import { db } from "./firebase"; // Ensure firebaseConfig is correctly loaded here if not hardcoded
import type { FirestoreUserProfile, FirestoreBlogPost, Coach, BlogPost, UserRole, CoachStatus, Message, FirestoreMessage } from '@/types';

// --- Helper Functions for Data Mapping ---
const mapCoachFromFirestore = (docData: any, id: string): Coach => {
  const data = docData as Omit<FirestoreUserProfile, 'id'> & { createdAt?: Timestamp, updatedAt?: Timestamp };
  return {
    id,
    name: data.name || 'Unnamed Coach',
    email: data.email,
    bio: data.bio || 'No bio available.',
    specialties: data.specialties || [],
    keywords: data.keywords || [],
    profileImageUrl: data.profileImageUrl === undefined ? null : data.profileImageUrl,
    dataAiHint: data.dataAiHint,
    certifications: data.certifications || [],
    socialLinks: data.socialLinks || [],
    location: data.location === undefined ? null : data.location,
    subscriptionTier: data.subscriptionTier || 'free',
    websiteUrl: data.websiteUrl === undefined ? null : data.websiteUrl,
    introVideoUrl: data.introVideoUrl === undefined ? null : data.introVideoUrl,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
    status: data.status || 'pending_approval',
    dataSource: 'Firestore',
  };
};

const mapBlogPostFromFirestore = (docData: any, id: string): BlogPost => {
  const data = docData as Omit<FirestoreBlogPost, 'id'> & { createdAt: Timestamp, updatedAt?: Timestamp };
  return {
    id,
    slug: data.slug || id,
    title: data.title || 'Untitled Post',
    content: data.content || '',
    excerpt: data.excerpt || '',
    authorId: data.authorId || 'unknown_author',
    authorName: data.authorName || 'Unknown Author',
    createdAt: data.createdAt.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
    status: data.status || 'draft',
    tags: data.tags || [],
    featuredImageUrl: data.featuredImageUrl === undefined ? undefined : (data.featuredImageUrl || undefined),
    dataAiHint: data.dataAiHint,
  };
};

const mapMessageFromFirestore = (docData: any, id: string): Message => {
  const data = docData as Omit<FirestoreMessage, 'id'> & { timestamp: Timestamp };
  return {
    id,
    senderId: data.senderId,
    senderName: data.senderName,
    recipientId: data.recipientId,
    recipientName: data.recipientName,
    content: data.content,
    timestamp: data.timestamp.toDate().toISOString(),
    read: data.read || false,
  };
};


// --- User Profile Functions ---
export async function setUserProfile(userId: string, profileData: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>>) {
  console.log(`[setUserProfile] Called for user: ${userId}`);
  console.log("[setUserProfile] Incoming profileData (original from auth.tsx or form):", JSON.stringify(profileData, null, 2));

  if (!userId) {
    console.error("[setUserProfile] CRITICAL: userId is undefined or null. Profile cannot be saved.");
    throw new Error("User ID is required to set user profile.");
  }
  if (profileData.email === undefined && !profileData.name) { // Basic check if this is an empty/problematic call
     console.warn("[setUserProfile] Attempting to set profile with minimal/no data for user:", userId, profileData);
  }

  const userDocRef = doc(db, "users", userId);

  try {
    const userSnap = await getDoc(userDocRef);
    const isCreating = !userSnap.exists();

    const dataToSet: { [key: string]: any } = {
      updatedAt: serverTimestamp(), // Always set/update this
    };

    // Conditionally add fields from profileData only if they are defined
    if (profileData.name !== undefined) dataToSet.name = profileData.name;
    
    // Email and Role are typically set only on creation and come from auth context
    if (isCreating) {
      if (profileData.email === undefined) {
        console.error(`[setUserProfile] CRITICAL: Email is undefined during profile CREATION for user ${userId}.`);
        throw new Error("Email is required for new user profile creation.");
      }
      dataToSet.email = profileData.email;

      if (profileData.role === undefined) {
        console.error(`[setUserProfile] CRITICAL: Role is undefined during profile CREATION for user ${userId}.`);
        throw new Error("Role is required for new user profile creation.");
      }
      dataToSet.role = profileData.role;
      dataToSet.createdAt = serverTimestamp();

      // Defaults for new coaches
      if (profileData.role === 'coach') {
        dataToSet.subscriptionTier = profileData.subscriptionTier !== undefined ? profileData.subscriptionTier : 'free';
        dataToSet.status = profileData.status !== undefined ? profileData.status : 'pending_approval';
      }
      // For new users/admins, ensure profileImageUrl is explicitly null if not provided
      if (profileData.profileImageUrl === undefined) {
        dataToSet.profileImageUrl = null;
      } else {
        dataToSet.profileImageUrl = profileData.profileImageUrl; // Can be null or a string
      }
    }


    // For updates, only add fields if they are in profileData (excluding immutable ones like email, role, createdAt for user-updates)
    if (!isCreating) {
      if (profileData.bio !== undefined) dataToSet.bio = profileData.bio;
      if (profileData.specialties !== undefined) dataToSet.specialties = profileData.specialties;
      if (profileData.keywords !== undefined) dataToSet.keywords = profileData.keywords;
      if (profileData.profileImageUrl !== undefined) dataToSet.profileImageUrl = profileData.profileImageUrl; // Can be set to null to clear
      if (profileData.certifications !== undefined) dataToSet.certifications = profileData.certifications;
      if (profileData.location !== undefined) dataToSet.location = profileData.location;
      if (profileData.websiteUrl !== undefined) dataToSet.websiteUrl = profileData.websiteUrl;
      if (profileData.introVideoUrl !== undefined) dataToSet.introVideoUrl = profileData.introVideoUrl;
      if (profileData.socialLinks !== undefined) dataToSet.socialLinks = profileData.socialLinks;
      // Admin can change these:
      if (profileData.status !== undefined) dataToSet.status = profileData.status;
      if (profileData.subscriptionTier !== undefined) dataToSet.subscriptionTier = profileData.subscriptionTier;
    }
    
    console.log(`[setUserProfile] FINAL data object for ${isCreating ? 'setDoc (new)' : 'setDoc (merge)'} on /users/${userId}:`, JSON.stringify(dataToSet, null, 2));
    
    await setDoc(userDocRef, dataToSet, { merge: !isCreating }); 
    
    console.log(`[setUserProfile] User profile data written successfully for user: ${userId}. Operation: ${isCreating ? 'CREATE' : 'UPDATE'}`);

  } catch (error: any) {
    console.error(`[setUserProfile] Error creating/updating user profile for ${userId}:`, error.code, error.message, error);
    console.error("[setUserProfile] Data that was attempted (original profileData arg):", JSON.stringify(profileData, null, 2)); 
    throw error;
  }
}

export async function getUserProfile(userId: string): Promise<(FirestoreUserProfile & { id: string }) | null> {
  // ... (existing implementation is likely fine)
  if (!userId) return null;
  const userDocRef = doc(db, "users", userId);
  const userSnap = await getDoc(userDocRef);
  if (userSnap.exists()) {
    return { id: userSnap.id, ...userSnap.data() } as (FirestoreUserProfile & { id: string });
  }
  return null;
}

// --- Coach Fetching Functions ---
export async function getFeaturedCoaches(count = 3): Promise<Coach[]> {
  console.log(`[getFeaturedCoaches] Attempting to fetch ${count} approved featured coaches...`);
  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", "coach"),
      where("status", "==", "approved"),
      orderBy("name", "asc"), // Temporarily removed for debugging, ensure index (role ASC, status ASC, name ASC) exists
      firestoreLimit(count)
    );
    console.log("[getFeaturedCoaches] Executing query...");
    const querySnapshot = await getDocs(q);
    console.log(`[getFeaturedCoaches] Firestore query returned ${querySnapshot.docs.length} documents.`);
    const coaches = querySnapshot.docs.map(docSnapshot => {
      console.log(`[getFeaturedCoaches] Mapping doc: ${docSnapshot.id}`, docSnapshot.data());
      return mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
    });
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

export async function getAllCoaches(filters?: { searchTerm?: string, includeAllStatuses?: boolean }): Promise<Coach[]> {
  console.log("[getAllCoaches] Fetching coaches. Filters:", JSON.stringify(filters) || "None");
  try {
    let q = query(collection(db, "users"), where("role", "==", "coach"));

    if (!filters?.includeAllStatuses) {
      q = query(q, where("status", "==", "approved"));
    }
    
    q = query(q, orderBy("name", "asc"), firestoreLimit(50)); // Ensure index (role ASC, status ASC, name ASC) or (role ASC, name ASC) exists

    console.log("[getAllCoaches] Executing Firestore query for coaches.");
    const querySnapshot = await getDocs(q);
    console.log(`[getAllCoaches] Firestore query returned ${querySnapshot.docs.length} coaches.`);
    
    let allCoaches = querySnapshot.docs.map(docSnapshot => mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id));

    if (filters?.searchTerm) {
      const lowerSearchTerm = filters.searchTerm.toLowerCase();
      allCoaches = allCoaches.filter(coach =>
        coach.name.toLowerCase().includes(lowerSearchTerm) ||
        (coach.bio && coach.bio.toLowerCase().includes(lowerSearchTerm)) ||
        coach.specialties.some(s => s.toLowerCase().includes(lowerSearchTerm)) ||
        (coach.keywords && coach.keywords.some(k => k.toLowerCase().includes(lowerSearchTerm)))
      );
    }
    console.log(`[getAllCoaches] Returning ${allCoaches.length} coaches after client-side filtering (if any).`);
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
  // ... (existing implementation is likely fine)
  if (!coachId) return null;
  const userProfile = await getUserProfile(coachId);
  if (userProfile && userProfile.role === 'coach') {
    return mapCoachFromFirestore(userProfile, userProfile.id);
  }
  return null;
}

// ... (getAllCoachIds, updateCoachSubscriptionTier, updateCoachStatus remain largely the same) ...

// --- Blog Post Functions ---
// ... (createFirestoreBlogPost, updateFirestoreBlogPost, getFirestoreBlogPost, getFirestoreBlogPostBySlug, getAllPublishedBlogPostSlugs, updateBlogPostStatus, getAllBlogPostsForAdmin, getMyBlogPosts remain largely the same) ...
// Ensure getBlogPostsByAuthor filters by status: "published" for public views.
export async function getBlogPostsByAuthor(authorId: string, count = 10): Promise<BlogPost[]> {
  console.log(`[getBlogPostsByAuthor] Fetching ${count} *published* posts for author: ${authorId}`);
  try {
    const blogsCollection = collection(db, "blogs");
    const q = query(
      blogsCollection,
      where("authorId", "==", authorId),
      where("status", "==", "published"), // CRITICAL: Only fetch published posts
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


// --- Messaging Functions ---
export async function sendMessage(messageData: Omit<FirestoreMessage, 'id' | 'timestamp' | 'read'>): Promise<string> {
  console.log("[sendMessage] Attempting to send message with data:", JSON.stringify(messageData, null, 2));
  try {
    const messagesCollection = collection(db, "messages");
    const messageToSend: Omit<FirestoreMessage, 'id'> = {
      ...messageData,
      timestamp: serverTimestamp(),
      read: false,
    };
    const newMessageRef = await addDoc(messagesCollection, messageToSend);
    console.log("[sendMessage] Message sent successfully with ID:", newMessageRef.id);
    return newMessageRef.id;
  } catch (error: any) {
    console.error("[sendMessage] Error sending message:", error.code, error.message, error);
    console.error("[sendMessage] Data that was attempted:", JSON.stringify(messageData, null, 2));
    throw error;
  }
}

export async function getMessagesForUser(userId: string): Promise<Message[]> {
  console.log(`[getMessagesForUser] Fetching messages for user: ${userId}`);
  if (!userId) return [];
  try {
    const messagesRef = collection(db, "messages");
    const qSent = query(messagesRef, where("senderId", "==", userId), orderBy("timestamp", "desc"), firestoreLimit(20));
    const qReceived = query(messagesRef, where("recipientId", "==", userId), orderBy("timestamp", "desc"), firestoreLimit(20));

    const [sentSnapshot, receivedSnapshot] = await Promise.all([
      getDocs(qSent),
      getDocs(qReceived)
    ]);

    const messagesMap = new Map<string, Message>();
    sentSnapshot.forEach(doc => messagesMap.set(doc.id, mapMessageFromFirestore(doc.data(), doc.id)));
    receivedSnapshot.forEach(doc => {
      if (!messagesMap.has(doc.id)) { // Avoid duplicates if user messaged themselves
        messagesMap.set(doc.id, mapMessageFromFirestore(doc.data(), doc.id));
      }
    });
    
    const allMessages = Array.from(messagesMap.values());
    allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    console.log(`[getMessagesForUser] Fetched and processed ${allMessages.length} messages for user ${userId}`);
    return allMessages;
  } catch (error: any) {
    console.error(`[getMessagesForUser] Error fetching messages for user ${userId}:`, error.code, error.message, error);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
        console.error("[getMessagesForUser] This is likely a Firestore Security Rule issue or missing/incorrect indexes for messages queries.");
    }
    return [];
  }
}

// --- Admin Dashboard Stat Functions (Basic Count Implementations) ---
// (getPendingCoachCount, getPendingBlogPostCount, getTotalUserCount, getTotalCoachCount - existing are likely okay)

// --- Coach Dashboard Stat Functions ---
// (getCoachBlogStats, getCoachUnreadMessageCount - existing are likely okay)

// Make sure all other existing functions like getAllCoachIds, updateCoachSubscriptionTier, updateCoachStatus,
// createFirestoreBlogPost, updateFirestoreBlogPost, getFirestoreBlogPost, getFirestoreBlogPostBySlug,
// getAllPublishedBlogPostSlugs, deleteFirestoreBlogPost, getAllBlogPostsForAdmin, getMyBlogPosts
// are present and correct based on previous iterations. I've focused on the messaging and related type changes here.

// Re-add other functions from previous versions that were not modified if they were removed accidentally.
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
      featuredImageUrl: postData.featuredImageUrl || null,
      excerpt: postData.excerpt || '',
    };
    
    const newPostRef = await addDoc(blogsCollection, dataWithTimestampsAndSlug);
    return newPostRef.id;
  } catch (error) {
    console.error("[createFirestoreBlogPost] Error creating blog post:", error);
    throw error;
  }
}

export async function updateFirestoreBlogPost(postId: string, postData: Partial<Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'authorId' | 'authorName' | 'slug'>>) {
  try {
    const postDocRef = doc(db, "blogs", postId);
    const dataToUpdate: any = { // Use any for flexibility during update
      ...postData,
      updatedAt: serverTimestamp()
    };
     if (postData.tags && typeof postData.tags === 'string') {
        dataToUpdate.tags = (postData.tags as string).split(',').map(tag => tag.trim()).filter(Boolean);
    } else if (Array.isArray(postData.tags)) {
        dataToUpdate.tags = postData.tags.map(tag => tag.trim()).filter(Boolean);
    } else if (postData.tags === undefined && !dataToUpdate.hasOwnProperty('tags')) { // Avoid deleting if not explicitly passed
        // Do nothing, keeps existing tags
    } else {
        dataToUpdate.tags = []; // Default to empty if invalid or explicitly cleared
    }


    if (postData.hasOwnProperty('featuredImageUrl')) {
      dataToUpdate.featuredImageUrl = postData.featuredImageUrl || null;
    }
    if (postData.hasOwnProperty('excerpt')) {
      dataToUpdate.excerpt = postData.excerpt || '';
    }
    if (postData.hasOwnProperty('content')) {
      dataToUpdate.content = postData.content || '';
    }
    if (postData.hasOwnProperty('title')) {
      dataToUpdate.title = postData.title || '';
    }


    await updateDoc(postDocRef, dataToUpdate);
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
    }
    return null;
  } catch (error) {
    console.error(`[getFirestoreBlogPost] Error getting blog post by ID ${postId}:`, error);
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
    }
    return null;
  } catch (error) {
    console.error(`[getFirestoreBlogPostBySlug] Error getting blog post by slug ${slug}:`, error);
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
    return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
  } catch (error) {
    console.error("[getPublishedBlogPosts] Error getting published blog posts:", error);
    return [];
  }
}


export async function getAllPublishedBlogPostSlugs(): Promise<string[]> {
  try {
    const q = query(collection(db, "blogs"), where("status", "==", "published"));
    const querySnapshot = await getDocs(q);
    const slugs = querySnapshot.docs.map(docSnapshot => (docSnapshot.data() as FirestoreBlogPost).slug).filter(Boolean);
    return slugs;
  } catch (error) {
    console.error("[getAllPublishedBlogPostSlugs] Error getting all published blog post slugs:", error);
    return [];
  }
}

export async function updateBlogPostStatus(postId: string, status: FirestoreBlogPost['status']): Promise<void> {
  try {
    const postDocRef = doc(db, "blogs", postId);
    await updateDoc(postDocRef, {
      status: status,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error(`[updateBlogPostStatus] Error updating blog post status for ${postId}:`, error);
    throw error;
  }
}

export async function deleteFirestoreBlogPost(postId: string): Promise<void> {
  try {
    const postDocRef = doc(db, "blogs", postId);
    await deleteDoc(postDocRef);
  } catch (error) {
    console.error(`[deleteFirestoreBlogPost] Error deleting blog post ${postId}:`, error);
    throw error;
  }
}

export async function getAllBlogPostsForAdmin(count = 50): Promise<BlogPost[]> {
  try {
    const blogsCollection = collection(db, "blogs");
    const q = query(
      blogsCollection,
      orderBy("createdAt", "desc"),
      firestoreLimit(count)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
  } catch (error) {
    console.error("[getAllBlogPostsForAdmin] Error getting all blog posts for admin:", error);
    return [];
  }
}

export async function getMyBlogPosts(authorId: string, count = 50): Promise<BlogPost[]> {
  try {
    const blogsCollection = collection(db, "blogs");
    const q = query(
      blogsCollection,
      where("authorId", "==", authorId),
      orderBy("createdAt", "desc"),
      firestoreLimit(count)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
  } catch (error: any) {
     console.error(`[getMyBlogPosts] Error getting blog posts for author ${authorId}:`, error.code, error.message);
    if (error.code === 'failed-precondition') { 
        console.error("[getMyBlogPosts] This is likely a missing/incorrect index for query on 'blogs' collection: (authorId ASC, createdAt DESC). Please create this index in Firestore.");
    }
    return [];
  }
}


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
    const q = query(collection(db, "users")); 
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
        const q = query(messagesCollection, where("recipientId", "==", coachId), where("read", "==", false));
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
    } catch (error) {
        console.error(`Error getting unread message count for coach ${coachId}:`, error);
        return 0;
    }
}
