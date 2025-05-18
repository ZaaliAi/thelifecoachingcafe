
import type { Timestamp } from "firebase/firestore";
import {
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs,
  serverTimestamp, limit as firestoreLimit, updateDoc, where, deleteDoc, writeBatch, runTransaction, collectionGroup, getCountFromServer
} from "firebase/firestore";
import { db } from "./firebase";
import type { FirestoreUserProfile, FirestoreBlogPost, Coach, BlogPost, UserRole, CoachStatus, Message as MessageType, FirestoreMessage } from '@/types';

// --- Helper Functions for Data Mapping ---
const mapCoachFromFirestore = (docData: any, id: string): Coach => {
  const data = docData as Omit<FirestoreUserProfile, 'id'> & { createdAt?: Timestamp, updatedAt?: Timestamp, status?: CoachStatus };
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
    status: data.status || 'pending_approval',
    websiteUrl: data.websiteUrl === undefined ? null : data.websiteUrl,
    introVideoUrl: data.introVideoUrl === undefined ? null : data.introVideoUrl,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
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

const mapMessageFromFirestore = (docData: any, id: string): MessageType => {
  const data = docData as Omit<FirestoreMessage, 'id'> & { timestamp: Timestamp };
  return {
    id,
    senderId: data.senderId,
    senderName: data.senderName || 'Unknown Sender',
    recipientId: data.recipientId,
    recipientName: data.recipientName || 'Unknown Recipient',
    content: data.content,
    timestamp: data.timestamp.toDate().toISOString(),
    read: data.read || false,
  };
};


// --- User Profile Functions ---
export async function setUserProfile(userId: string, profileData: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>>) {
  console.log(`[setUserProfile] Called for user: ${userId}.`);
  console.log("[setUserProfile] Data that was attempted (original profileData arg):", JSON.stringify(profileData, null, 2));


  if (!userId) {
    console.error("[setUserProfile] CRITICAL: userId is undefined or null. Profile cannot be saved.");
    throw new Error("User ID is required to set user profile.");
  }
  if (profileData.email === undefined && !Object.keys(profileData).includes('name')) { // Simple check if it's an update vs initial create
      // This is an update operation for existing user from profile page.
      // Email and role should not be in profileData from client for owner updates.
      if (profileData.hasOwnProperty('email')) {
        console.warn("[setUserProfile] Attempt to update email ignored for user:", userId);
        delete profileData.email;
      }
      if (profileData.hasOwnProperty('role')) {
        console.warn("[setUserProfile] Attempt to update role ignored for user:", userId);
        delete profileData.role;
      }
  }


  const userDocRef = doc(db, "users", userId);

  try {
    const userSnap = await getDoc(userDocRef);
    const isCreating = !userSnap.exists();
    console.log(`[setUserProfile] Is creating new document for ${userId}: ${isCreating}`);

    const dataToSet: { [key: string]: any } = {
      updatedAt: serverTimestamp(), // Always set/update this
    };

    // Conditionally add fields from profileData only if they are defined
    if (profileData.name !== undefined) dataToSet.name = profileData.name;
    if (profileData.email !== undefined) dataToSet.email = profileData.email;
    if (profileData.role !== undefined) dataToSet.role = profileData.role;
    if (profileData.bio !== undefined) dataToSet.bio = profileData.bio;
    if (profileData.specialties !== undefined) dataToSet.specialties = profileData.specialties;
    if (profileData.keywords !== undefined) dataToSet.keywords = profileData.keywords;
    
    // Handle null explicitly for optional fields that can be cleared
    dataToSet.profileImageUrl = profileData.profileImageUrl === undefined ? (isCreating ? null : userSnap.data()?.profileImageUrl) : profileData.profileImageUrl;
    
    if (profileData.certifications !== undefined) dataToSet.certifications = profileData.certifications;
    
    dataToSet.location = profileData.location === undefined ? (isCreating ? null : userSnap.data()?.location) : (profileData.location || null);
    dataToSet.websiteUrl = profileData.websiteUrl === undefined ? (isCreating ? null : userSnap.data()?.websiteUrl) : (profileData.websiteUrl || null);
    dataToSet.introVideoUrl = profileData.introVideoUrl === undefined ? (isCreating ? null : userSnap.data()?.introVideoUrl) : (profileData.introVideoUrl || null);
    
    if (profileData.socialLinks !== undefined) dataToSet.socialLinks = profileData.socialLinks;


    if (isCreating) {
      if (!dataToSet.email || !dataToSet.role || !dataToSet.name) {
        const missingFields = [];
        if (!dataToSet.email) missingFields.push('email');
        if (!dataToSet.role) missingFields.push('role');
        if (!dataToSet.name) missingFields.push('name');
        console.error(`[setUserProfile] CRITICAL: Missing essential fields for new user ${userId}: ${missingFields.join(', ')}`);
        throw new Error(`Essential fields missing for new user profile: ${missingFields.join(', ')}`);
      }
      dataToSet.createdAt = serverTimestamp();
      if (profileData.role === 'coach') {
        dataToSet.subscriptionTier = profileData.subscriptionTier || 'free'; // Default to 'free' if not specified
        dataToSet.status = profileData.status || 'pending_approval'; // Default for new coaches
      }
    } else {
      // For updates, only include subscriptionTier or status if they are explicitly in profileData
      // (typically only changed by admin)
      if (profileData.subscriptionTier !== undefined) {
        dataToSet.subscriptionTier = profileData.subscriptionTier;
      }
      if (profileData.status !== undefined) {
        dataToSet.status = profileData.status;
      }
    }
    
    console.log(`[setUserProfile] FINAL data object for setDoc for user ${userId} (merge: ${!isCreating}):`, JSON.stringify(dataToSet, null, 2));
    
    await setDoc(userDocRef, dataToSet, { merge: !isCreating });
    
    console.log(`[setUserProfile] User profile data written successfully for user: ${userId}. Operation: ${isCreating ? 'CREATE' : 'UPDATE'}`);

  } catch (error) {
    console.error(`[setUserProfile] Error creating/updating user profile for ${userId}:`, error);
    console.error("[setUserProfile] Data that was attempted (original profileData arg):", JSON.stringify(profileData, null, 2)); 
    throw error;
  }
}


export async function getUserProfile(userId: string): Promise<FirestoreUserProfile | null> {
  if (!userId) {
    console.warn("[getUserProfile] Attempted to fetch profile with no userId.");
    return null;
  }
  const userDocRef = doc(db, "users", userId);
  console.log(`[getUserProfile] Fetching profile for userId: ${userId}`);
  const userSnap = await getDoc(userDocRef);
  if (userSnap.exists()) {
    console.log(`[getUserProfile] Profile found for userId: ${userId}`);
    return { id: userSnap.id, ...userSnap.data() } as FirestoreUserProfile;
  }
  console.log(`[getUserProfile] No profile found for userId: ${userId}`);
  return null;
}

// --- Coach Fetching Functions ---
export async function getFeaturedCoaches(count = 3): Promise<Coach[]> {
  console.log(`[getFeaturedCoaches] Fetching up to ${count} approved, featured coaches...`);
  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", "coach"),
      where("status", "==", "approved"),
      orderBy("name", "asc"), // Restored orderBy
      firestoreLimit(count)
    );
    console.log("[getFeaturedCoaches] Executing Firestore query:", q);
    const querySnapshot = await getDocs(q);
    console.log(`[getFeaturedCoaches] Firestore query returned ${querySnapshot.docs.length} documents.`);
    
    const coaches = querySnapshot.docs.map(docSnapshot => {
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
    const qConstraints: any[] = [where("role", "==", "coach")];

    if (!filters?.includeAllStatuses) {
      qConstraints.push(where("status", "==", "approved"));
    }
    
    qConstraints.push(orderBy("name", "asc")); // Restored orderBy
    qConstraints.push(firestoreLimit(50)); 

    const coachesQuery = query(collection(db, "users"), ...qConstraints);

    console.log("[getAllCoaches] Executing Firestore query for coaches:", coachesQuery);
    const querySnapshot = await getDocs(coachesQuery);
    console.log(`[getAllCoaches] Firestore query returned ${querySnapshot.docs.length} coaches initially.`);
    
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
    }
    console.log(`[getAllCoaches] Returning ${allCoaches.length} coaches after client-side filtering (if any).`);
    return allCoaches;
  } catch (error: any) {
    console.error("[getAllCoaches] Error getting all coaches:", error.code, error.message, error);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
      console.error("[getAllCoaches] This is likely a Firestore Security Rule issue or a missing/incorrect index (users: role ASC, status ASC, name ASC - or simpler if orderBy name is removed).");
    }
    return [];
  }
}


export async function getCoachById(coachId: string): Promise<Coach | null> {
  if (!coachId) {
    console.warn("[getCoachById] Attempted to fetch coach with no ID.");
    return null;
  }
  try {
    const userProfile = await getUserProfile(coachId);
    if (userProfile && userProfile.role === 'coach') {
      return mapCoachFromFirestore(userProfile, userProfile.id);
    }
    console.warn(`[getCoachById] User with ID ${coachId} is not a coach or does not exist.`);
    return null;
  } catch (error: any) {
     console.error(`[getCoachById] Error fetching coach by ID ${coachId}:`, error.code, error.message);
     return null;
  }
}

export async function getAllCoachIds(): Promise<string[]> {
  try {
    const q = query(collection(db, "users"), where("role", "==", "coach"), where("status", "==", "approved"));
    const querySnapshot = await getDocs(q);
    const ids = querySnapshot.docs.map(docSnapshot => docSnapshot.id);
    console.log(`[getAllCoachIds] Fetched ${ids.length} approved coach IDs.`);
    return ids;
  } catch (error) {
    console.error("[getAllCoachIds] Error getting all coach IDs:", error);
    return [];
  }
}

export async function updateCoachSubscriptionTier(coachId: string, tier: 'free' | 'premium'): Promise<void> {
  try {
    const coachDocRef = doc(db, "users", coachId);
    await updateDoc(coachDocRef, {
      subscriptionTier: tier,
      updatedAt: serverTimestamp()
    });
    console.log(`[updateCoachSubscriptionTier] Updated subscription tier for coach ${coachId} to ${tier}.`);
  } catch (error) {
    console.error(`[updateCoachSubscriptionTier] Error updating coach subscription tier for ${coachId}:`, error);
    throw error;
  }
}

export async function updateCoachStatus(coachId: string, status: CoachStatus): Promise<void> {
  try {
    const coachDocRef = doc(db, "users", coachId);
    await updateDoc(coachDocRef, {
      status: status,
      updatedAt: serverTimestamp()
    });
     console.log(`[updateCoachStatus] Updated status for coach ${coachId} to ${status}.`);
  } catch (error) {
    console.error(`[updateCoachStatus] Error updating coach status for ${coachId}:`, error);
    throw error;
  }
}

// --- Blog Post Functions ---
export async function createFirestoreBlogPost(postData: Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'updatedAt' | 'slug'> & { slug?: string }): Promise<string> {
  try {
    const blogsCollection = collection(db, "blogs");
    const slug = postData.slug || (postData.title ? postData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') : `post-${Date.now()}`);
    
    const dataWithTimestampsAndSlug: Omit<FirestoreBlogPost, 'id'> = {
      ...postData,
      slug: slug,
      createdAt: serverTimestamp() as Timestamp, 
      updatedAt: serverTimestamp() as Timestamp,
      tags: postData.tags || [],
      featuredImageUrl: postData.featuredImageUrl || null, 
      excerpt: postData.excerpt || '',
      status: postData.status || 'draft',
    };
    
    const newPostRef = await addDoc(blogsCollection, dataWithTimestampsAndSlug);
    console.log(`[createFirestoreBlogPost] Created blog post with ID: ${newPostRef.id}`);
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
    if (postData.hasOwnProperty('featuredImageUrl')) { 
      dataToUpdate.featuredImageUrl = postData.featuredImageUrl || null;
    }
    if (postData.status !== undefined) dataToUpdate.status = postData.status;

    await updateDoc(postDocRef, dataToUpdate);
    console.log(`[updateFirestoreBlogPost] Updated blog post with ID: ${postId}`);
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
    console.warn(`[getFirestoreBlogPost] No blog post found with ID: ${postId}`);
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
    console.warn(`[getFirestoreBlogPostBySlug] No blog post found with slug: ${slug}`);
    return null;
  } catch (error: any) {
    console.error(`[getFirestoreBlogPostBySlug] Error getting blog post by slug ${slug}:`, error.code, error.message, error);
    if (error.code === 'failed-precondition') {
      console.error("[getFirestoreBlogPostBySlug] This is likely a missing/incorrect index for query on 'blogs' collection: (slug ASC). Please create this index in Firestore.");
    }
    return null;
  }
}

export async function getPublishedBlogPosts(count = 10): Promise<BlogPost[]> {
  console.log(`[getPublishedBlogPosts] Fetching up to ${count} published blog posts.`);
  try {
    const blogsCollection = collection(db, "blogs");
    const q = query(
      blogsCollection,
      where("status", "==", "published"),
      orderBy("createdAt", "desc"),
      firestoreLimit(count)
    );
    const querySnapshot = await getDocs(q);
    console.log(`[getPublishedBlogPosts] Fetched ${querySnapshot.docs.length} published blog posts.`);
    return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
  } catch (error: any) {
    console.error("[getPublishedBlogPosts] Error getting published blog posts:", error.code, error.message, error);
     if (error.code === 'failed-precondition') { 
        console.error("[getPublishedBlogPosts] This is likely a missing/incorrect index for query on 'blogs' collection: (status ASC, createdAt DESC). Please create this index in Firestore.");
    }
    return [];
  }
}


export async function getAllPublishedBlogPostSlugs(): Promise<string[]> {
  try {
    const q = query(collection(db, "blogs"), where("status", "==", "published"));
    const querySnapshot = await getDocs(q);
    const slugs = querySnapshot.docs.map(docSnapshot => (docSnapshot.data() as FirestoreBlogPost).slug).filter(Boolean);
    console.log(`[getAllPublishedBlogPostSlugs] Fetched ${slugs.length} slugs.`);
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
    console.log(`[updateBlogPostStatus] Updated status for blog post ${postId} to ${status}.`);
  } catch (error) {
    console.error(`[updateBlogPostStatus] Error updating blog post status for ${postId}:`, error);
    throw error;
  }
}

export async function deleteFirestoreBlogPost(postId: string): Promise<void> {
  try {
    const postDocRef = doc(db, "blogs", postId);
    await deleteDoc(postDocRef);
    console.log(`[deleteFirestoreBlogPost] Deleted blog post with ID: ${postId}`);
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
  } catch (error: any) {
    console.error("[getAllBlogPostsForAdmin] Error getting all blog posts for admin:", error.code, error.message);
     if (error.code === 'failed-precondition') { 
        console.error("[getAllBlogPostsForAdmin] This is likely a missing/incorrect index for query on 'blogs' collection: (createdAt DESC). Please create this index in Firestore.");
    }
    return [];
  }
}

export async function getMyBlogPosts(authorId: string, count = 50): Promise<BlogPost[]> {
  if (!authorId) { 
    console.warn("[getMyBlogPosts] authorId not provided.");
    return [];
  }
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
  if (!authorId) {
    console.warn("[getBlogPostsByAuthor] authorId not provided.");
    return [];
  }
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
    console.log(`[getBlogPostsByAuthor] Fetched ${querySnapshot.docs.length} posts for author ${authorId}.`);
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
  console.log("[sendMessage] Attempting to send message:", messageData);
  if (!messageData.senderId || !messageData.recipientId || !messageData.content || !messageData.senderName || !messageData.recipientName) {
    console.error("[sendMessage] Critical data missing for sending message:", messageData);
    throw new Error("Sender ID, Recipient ID, content, sender name, and recipient name are required.");
  }
  try {
    const messagesCollection = collection(db, "messages");
    const messageToSend: Omit<FirestoreMessage, 'id'> = {
      senderId: messageData.senderId,
      senderName: messageData.senderName,
      recipientId: messageData.recipientId,
      recipientName: messageData.recipientName,
      content: messageData.content, 
      timestamp: serverTimestamp() as Timestamp,
      read: false, 
    };
    const newMessageRef = await addDoc(messagesCollection, messageToSend);
    console.log(`[sendMessage] Message sent with ID: ${newMessageRef.id}`);
    return newMessageRef.id;
  } catch (error: any) {
    console.error("[sendMessage] Error sending message:", error.code, error.message, error);
    console.error("[sendMessage] Data that was attempted:", JSON.stringify(messageData, null, 2));
    throw error;
  }
}

export async function markMessagesAsRead(messageIdsToMark: string[], currentUserId: string): Promise<void> {
  if (!messageIdsToMark || messageIdsToMark.length === 0) {
    console.log("[markMessagesAsRead] No message IDs provided to mark as read.");
    return;
  }
  if (!currentUserId) {
    console.warn("[markMessagesAsRead] currentUserId not provided, cannot mark messages as read.");
    return;
  }
  console.log(`[markMessagesAsRead] Attempting to mark ${messageIdsToMark.length} messages as read for user ${currentUserId}.`);

  const batch = writeBatch(db);
  let actuallyMarkedCount = 0;

  for (const messageId of messageIdsToMark) {
    const messageRef = doc(db, "messages", messageId);
    // No need to fetch the message first if we trust the client to send only IDs of messages addressed to them.
    // The security rule will prevent unauthorized updates.
    batch.update(messageRef, { read: true });
    actuallyMarkedCount++;
  }

  if (actuallyMarkedCount > 0) {
    try {
      await batch.commit();
      console.log(`[markMessagesAsRead] Successfully committed batch to mark ${actuallyMarkedCount} messages as read.`);
    } catch (error: any) {
      console.error(`[markMessagesAsRead] Error committing batch to mark messages as read for user ${currentUserId}:`, error.code, error.message, error);
      // Decide if you want to re-throw or just log
      // throw error; 
    }
  } else {
    console.log("[markMessagesAsRead] No messages were batched to be marked as read.");
  }
};


export async function getMessagesForUser(
  userId: string,
  otherPartyId?: string | null, // Make otherPartyId optional for fetching all conversations overview
  messageLimit: number = 30 // Default limit per query (sent/received)
): Promise<MessageType[]> {
  console.log(`[getMessagesForUser] Fetching messages. User: ${userId}, OtherParty: ${otherPartyId || 'All'}, Limit: ${messageLimit}`);
  if (!userId) {
    console.warn("[getMessagesForUser] No userId provided. Returning empty array.");
    return [];
  }

  const messagesRef = collection(db, "messages");
  const allMessagesMap = new Map<string, MessageType>();
  const messageIdsToMarkReadClientSide: string[] = [];

  // Query for messages sent by the user
  const sentQueryConstraints = [
    where("senderId", "==", userId),
    orderBy("timestamp", "desc"),
    firestoreLimit(messageLimit)
  ];
  if (otherPartyId) {
    sentQueryConstraints.splice(1, 0, where("recipientId", "==", otherPartyId)); // Insert recipient filter
  }
  const qSent = query(messagesRef, ...sentQueryConstraints);

  try {
    console.log(`[getMessagesForUser] Querying SENT messages for user ${userId}${otherPartyId ? ' to ' + otherPartyId : ''}...`);
    const sentSnapshot = await getDocs(qSent);
    console.log(`[getMessagesForUser] Fetched ${sentSnapshot.docs.length} messages sent by ${userId}.`);
    sentSnapshot.forEach(docSnap => {
      const msg = mapMessageFromFirestore(docSnap.data(), docSnap.id);
      allMessagesMap.set(docSnap.id, msg);
    });
  } catch (error: any) {
    console.error(`[getMessagesForUser] Error fetching SENT messages for user ${userId}:`, error.code, error.message, error);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
       console.error(`[getMessagesForUser] SENT query issue: likely Firestore Security Rule or missing/incorrect index (messages: senderId ASC, ${otherPartyId ? 'recipientId ASC, ' : ''}timestamp DESC).`);
    }
    // Do not throw here, try to get received messages
  }

  // Query for messages received by the user
  const receivedQueryConstraints = [
    where("recipientId", "==", userId),
    orderBy("timestamp", "desc"),
    firestoreLimit(messageLimit)
  ];
  if (otherPartyId) {
    receivedQueryConstraints.splice(1, 0, where("senderId", "==", otherPartyId)); // Insert sender filter
  }
  const qReceived = query(messagesRef, ...receivedQueryConstraints);

  try {
    console.log(`[getMessagesForUser] Querying RECEIVED messages for user ${userId}${otherPartyId ? ' from ' + otherPartyId : ''}...`);
    const receivedSnapshot = await getDocs(qReceived);
    console.log(`[getMessagesForUser] Fetched ${receivedSnapshot.docs.length} messages received by ${userId}.`);
    receivedSnapshot.forEach(docSnap => {
      const msg = mapMessageFromFirestore(docSnap.data(), docSnap.id);
      if (!allMessagesMap.has(docSnap.id)) { // Avoid duplicates if somehow fetched by both
        allMessagesMap.set(docSnap.id, msg);
      }
      // If fetching for a specific conversation thread AND message is unread AND recipient is current user
      if (otherPartyId && !msg.read && msg.recipientId === userId) {
        messageIdsToMarkReadClientSide.push(msg.id);
      }
    });
  } catch (error: any) {
    console.error(`[getMessagesForUser] Error fetching RECEIVED messages for user ${userId}:`, error.code, error.message, error);
     if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
       console.error(`[getMessagesForUser] RECEIVED query issue: likely Firestore Security Rule or missing/incorrect index (messages: recipientId ASC, ${otherPartyId ? 'senderId ASC, ' : ''}timestamp DESC).`);
    }
    // If both queries fail, then throw or return empty
    if (allMessagesMap.size === 0) throw error;
  }

  // If fetching for a specific conversation, mark messages as read
  if (otherPartyId && messageIdsToMarkReadClientSide.length > 0) {
    console.log(`[getMessagesForUser] Triggering markMessagesAsRead for ${messageIdsToMarkReadClientSide.length} messages for user ${userId} from other party ${otherPartyId}`);
    // Intentionally not awaiting this, can happen in background. Error handling is inside markMessagesAsRead.
    markMessagesAsRead(messageIdsToMarkReadClientSide, userId)
      .catch(err => console.error("[getMessagesForUser] Background markMessagesAsRead failed:", err));
  }
  
  const combinedMessages = Array.from(allMessagesMap.values());
  // Sort oldest to newest for thread display, or newest to oldest for list overview
  combinedMessages.sort((a, b) => 
    otherPartyId 
      ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() // For thread view: oldest first
      : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() // For list view: newest first
  );
  
  console.log(`[getMessagesForUser] Processed ${combinedMessages.length} total unique messages for user ${userId}.`);
  return combinedMessages.slice(0, otherPartyId ? undefined : 50); // If it's a thread, return all, else limit for overview
}


// --- Admin Dashboard Stats ---
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
        // For pending, consider 'draft' and 'pending_approval'
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
    } catch (error: any) {
        console.error(`Error getting blog stats for coach ${authorId}:`, error.code, error.message);
         if (error.code === 'failed-precondition') {
             console.error(`[getCoachBlogStats] Index missing for query on 'blogs'. Common indexes needed: (authorId ASC, status ASC) or (authorId ASC, status IN [...]).`);
        }
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
    } catch (error: any) {
        console.error(`Error getting unread message count for coach ${coachId}:`, error.code, error.message);
        if (error.code === 'failed-precondition') {
             console.error("[getCoachUnreadMessageCount] This is likely a missing/incorrect index for query on 'messages' collection: (recipientId ASC, read ASC). Please create this index in Firestore.");
        }
        return 0;
    }
}
