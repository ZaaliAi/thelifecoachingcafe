
import type { Timestamp } from "firebase/firestore";
import {
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs,
  serverTimestamp, limit as firestoreLimit, updateDoc, where, deleteDoc, writeBatch, runTransaction, collectionGroup, getCountFromServer
} from "firebase/firestore";
import { db } from "./firebase";
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
    dataSource: 'Firestore', // Added for debugging
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

  const userDocRef = doc(db, "users", userId);

  try {
    const userSnap = await getDoc(userDocRef);
    const isCreating = !userSnap.exists();

    const dataToSet: { [key: string]: any } = {
      // Always set/update this for both create and update
      updatedAt: serverTimestamp(),
    };

    // Fields for initial creation or general update
    if (profileData.name !== undefined) dataToSet.name = profileData.name;
    if (profileData.bio !== undefined) dataToSet.bio = profileData.bio;
    if (profileData.specialties !== undefined) dataToSet.specialties = profileData.specialties;
    if (profileData.keywords !== undefined) dataToSet.keywords = profileData.keywords;
    
    // Handle profileImageUrl: allow null to clear, or a string
    if (profileData.hasOwnProperty('profileImageUrl')) {
      dataToSet.profileImageUrl = profileData.profileImageUrl === undefined ? null : profileData.profileImageUrl;
    } else if (isCreating) {
      dataToSet.profileImageUrl = null; // Ensure it's set to null on create if not provided
    }
    
    if (profileData.certifications !== undefined) dataToSet.certifications = profileData.certifications;
    if (profileData.location !== undefined) dataToSet.location = profileData.location === undefined ? null : profileData.location;
    if (profileData.websiteUrl !== undefined) dataToSet.websiteUrl = profileData.websiteUrl === undefined ? null : profileData.websiteUrl;
    if (profileData.introVideoUrl !== undefined) dataToSet.introVideoUrl = profileData.introVideoUrl === undefined ? null : profileData.introVideoUrl;
    if (profileData.socialLinks !== undefined) dataToSet.socialLinks = profileData.socialLinks;
    
    // Fields typically set only on creation or by admin
    if (isCreating) {
      if (profileData.email === undefined) throw new Error("[setUserProfile] Email is required for new user profile creation.");
      dataToSet.email = profileData.email;
      if (profileData.role === undefined) throw new Error("[setUserProfile] Role is required for new user profile creation.");
      dataToSet.role = profileData.role;
      dataToSet.createdAt = serverTimestamp();

      if (profileData.role === 'coach') {
        dataToSet.subscriptionTier = profileData.subscriptionTier !== undefined ? profileData.subscriptionTier : 'free';
        dataToSet.status = profileData.status !== undefined ? profileData.status : 'pending_approval';
      }
    } else {
      // For updates, admin might change these
      if (profileData.role !== undefined) dataToSet.role = profileData.role; // If admin changes role
      if (profileData.subscriptionTier !== undefined) dataToSet.subscriptionTier = profileData.subscriptionTier;
      if (profileData.status !== undefined) dataToSet.status = profileData.status;
    }
    
    console.log(`[setUserProfile] FINAL data object for ${isCreating ? 'setDoc (new)' : 'setDoc (merge)'} on /users/${userId}:`, JSON.stringify(dataToSet, null, 2));
    
    await setDoc(userDocRef, dataToSet, { merge: !isCreating }); 
    
    console.log(`[setUserProfile] User profile data written successfully for user: ${userId}. Operation: ${isCreating ? 'CREATE' : 'UPDATE'}`);

  } catch (error: any) {
    console.error(`[setUserProfile] Error creating/updating user profile for ${userId}:`, error);
    console.error("[setUserProfile] Data that was attempted (original profileData arg):", JSON.stringify(profileData, null, 2)); 
    throw error;
  }
}


export async function getUserProfile(userId: string): Promise<(FirestoreUserProfile & { id: string }) | null> {
  if (!userId) {
    console.warn("[getUserProfile] Attempted to fetch profile with no userId.");
    return null;
  }
  const userDocRef = doc(db, "users", userId);
  const userSnap = await getDoc(userDocRef);
  if (userSnap.exists()) {
    return { id: userSnap.id, ...userSnap.data() } as (FirestoreUserProfile & { id: string });
  }
  console.log(`[getUserProfile] No profile found for userId: ${userId}`);
  return null;
}

// --- Coach Fetching Functions ---
export async function getFeaturedCoaches(count = 3): Promise<Coach[]> {
  console.log(`[getFeaturedCoaches] Fetching up to ${count} approved featured coaches...`);
  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", "coach"),
      where("status", "==", "approved"),
      // orderBy("name", "asc"), // Temporarily removed for debugging permissions
      firestoreLimit(count)
    );
    console.log("[getFeaturedCoaches] Executing Firestore query...");
    const querySnapshot = await getDocs(q);
    console.log(`[getFeaturedCoaches] Firestore query returned ${querySnapshot.docs.length} documents.`);
    
    const coaches = querySnapshot.docs.map(docSnapshot => {
      // console.log(`[getFeaturedCoaches] Mapping doc: ${docSnapshot.id}`, docSnapshot.data());
      return mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
    });
    console.log(`[getFeaturedCoaches] Successfully fetched and mapped ${coaches.length} featured coaches.`);
    return coaches;
  } catch (error: any) {
    console.error("[getFeaturedCoaches] Error getting featured coaches:", error.code, error.message, error);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
        console.error("[getFeaturedCoaches] This is likely a Firestore Security Rule issue or a missing/incorrect index.");
    }
    return [];
  }
}

export async function getAllCoaches(filters?: { searchTerm?: string, includeAllStatuses?: boolean }): Promise<Coach[]> {
  console.log("[getAllCoaches] Fetching coaches. Filters:", JSON.stringify(filters) || "None");
  try {
    let qConstraints = [where("role", "==", "coach")];

    if (!filters?.includeAllStatuses) {
      qConstraints.push(where("status", "==", "approved"));
    }
    
    // Temporarily remove orderBy for debugging permission issues from Genkit flow
    // qConstraints.push(orderBy("name", "asc"));
    qConstraints.push(firestoreLimit(50)); 

    const coachesQuery = query(collection(db, "users"), ...qConstraints);

    console.log("[getAllCoaches] Executing Firestore query for coaches:", coachesQuery);
    const querySnapshot = await getDocs(coachesQuery);
    console.log(`[getAllCoaches] Firestore query returned ${querySnapshot.docs.length} coaches initially.`);
    
    let allCoaches = querySnapshot.docs.map(docSnapshot => {
      // console.log(`[getAllCoaches] Mapping doc: ${docSnapshot.id}`, docSnapshot.data());
      return mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
    });

    if (filters?.searchTerm) {
      const lowerSearchTerm = filters.searchTerm.toLowerCase();
      console.log(`[getAllCoaches] Applying client-side search for term: "${lowerSearchTerm}"`);
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
  if (!coachId) {
    console.warn("[getCoachById] Attempted to fetch coach with no ID.");
    return null;
  }
  console.log(`[getCoachById] Fetching coach with ID: ${coachId}`);
  try {
    const userProfile = await getUserProfile(coachId);
    if (userProfile && userProfile.role === 'coach') {
      console.log(`[getCoachById] Coach found for ID ${coachId}:`, userProfile.name);
      return mapCoachFromFirestore(userProfile, userProfile.id);
    }
    console.log(`[getCoachById] No coach found or user is not a coach for ID: ${coachId}`);
    return null;
  } catch (error: any) {
     console.error(`[getCoachById] Error fetching coach by ID ${coachId}:`, error.code, error.message);
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
    const dataToUpdate: any = { 
      updatedAt: serverTimestamp()
    };
    
    if (postData.title !== undefined) dataToUpdate.title = postData.title;
    if (postData.content !== undefined) dataToUpdate.content = postData.content;
    if (postData.excerpt !== undefined) dataToUpdate.excerpt = postData.excerpt;
    if (postData.tags !== undefined) {
       dataToUpdate.tags = Array.isArray(postData.tags) ? postData.tags.map(tag => tag.trim()).filter(Boolean) : [];
    }
    if (postData.hasOwnProperty('featuredImageUrl')) { // Allows setting to null/empty
      dataToUpdate.featuredImageUrl = postData.featuredImageUrl || null;
    }
    if (postData.status !== undefined) dataToUpdate.status = postData.status;


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

export async function getBlogPostsByAuthor(authorId: string, count = 2): Promise<BlogPost[]> {
  console.log(`[getBlogPostsByAuthor] Fetching ${count} *published* posts for author: ${authorId}`);
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


export async function sendMessage(messageData: Omit<FirestoreMessage, 'id' | 'timestamp' | 'read'>): Promise<string> {
  console.log("[sendMessage] Attempting to send message with data:", JSON.stringify(messageData, null, 2));
  try {
    const messagesCollection = collection(db, "messages");
    const messageToSend: Omit<FirestoreMessage, 'id'> = {
      ...messageData,
      timestamp: serverTimestamp(), // Correctly use serverTimestamp
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
    // Query for messages sent BY the user
    const qSent = query(messagesRef, where("senderId", "==", userId), orderBy("timestamp", "desc"), firestoreLimit(30));
    // Query for messages received BY the user
    const qReceived = query(messagesRef, where("recipientId", "==", userId), orderBy("timestamp", "desc"), firestoreLimit(30));

    const [sentSnapshot, receivedSnapshot] = await Promise.all([
      getDocs(qSent),
      getDocs(qReceived)
    ]);

    const messagesMap = new Map<string, Message>();

    sentSnapshot.forEach(docSnap => {
      messagesMap.set(docSnap.id, mapMessageFromFirestore(docSnap.data(), docSnap.id));
    });
    receivedSnapshot.forEach(docSnap => {
      // Avoid duplicates if a user messages themselves (though unlikely in this app)
      if (!messagesMap.has(docSnap.id)) {
        messagesMap.set(docSnap.id, mapMessageFromFirestore(docSnap.data(), docSnap.id));
      }
    });
    
    const allMessages = Array.from(messagesMap.values());
    // Sort all messages by timestamp descending
    allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    console.log(`[getMessagesForUser] Fetched and processed ${allMessages.length} messages for user ${userId}`);
    return allMessages.slice(0, 50); // Limit total combined messages for performance
  } catch (error: any) {
    console.error(`[getMessagesForUser] Error fetching messages for user ${userId}:`, error.code, error.message, error);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
        console.error("[getMessagesForUser] This is likely a Firestore Security Rule issue or missing/incorrect indexes for messages queries (e.g., senderId+timestamp, recipientId+timestamp).");
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
    const q = query(collection(db, "users"), where("role", "==", "coach"), where("status", "==", "approved"));
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

    