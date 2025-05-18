
import type { Timestamp } from "firebase/firestore";
import {
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs,
  serverTimestamp, limit as firestoreLimit, updateDoc, where, deleteDoc, writeBatch, runTransaction, collectionGroup, getCountFromServer
} from "firebase/firestore";
import { db } from "./firebase";
import type { FirestoreUserProfile, FirestoreBlogPost, Coach, BlogPost, UserRole, CoachStatus, Message, FirestoreMessage } from '@/types';

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
    websiteUrl: data.websiteUrl === undefined ? null : data.websiteUrl,
    introVideoUrl: data.introVideoUrl === undefined ? null : data.introVideoUrl,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
    status: data.status || 'pending_approval', // Default to pending if not set
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

const mapMessageFromFirestore = (docData: any, id: string, currentUserId: string): Message => {
  const data = docData as Omit<FirestoreMessage, 'id'> & { timestamp: Timestamp };
  let otherPartyId = '';
  let otherPartyName = 'Unknown';

  if (data.senderId === currentUserId) {
    otherPartyId = data.recipientId;
    otherPartyName = data.recipientName || 'Recipient';
  } else {
    otherPartyId = data.senderId;
    otherPartyName = data.senderName || 'Sender';
  }

  return {
    id,
    senderId: data.senderId,
    senderName: data.senderName || 'Unknown Sender',
    recipientId: data.recipientId,
    recipientName: data.recipientName || 'Unknown Recipient',
    content: data.content,
    timestamp: data.timestamp.toDate().toISOString(),
    read: data.read || false,
    otherPartyId: otherPartyId,
    otherPartyName: otherPartyName,
    // Avatar and dataAiHint should be populated when enriching conversations
  };
};


// --- User Profile Functions ---
export async function setUserProfile(userId: string, profileData: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>>) {
  console.log(`[setUserProfile] Called for user: ${userId}. profileData (before adding timestamps):`, JSON.stringify(profileData, null, 2));

  if (!userId) {
    console.error("[setUserProfile] CRITICAL: userId is undefined or null. Profile cannot be saved.");
    throw new Error("User ID is required to set user profile.");
  }

  const userDocRef = doc(db, "users", userId);

  try {
    const userSnap = await getDoc(userDocRef);
    const isCreating = !userSnap.exists();
    console.log(`[setUserProfile] Is creating new document for ${userId}: ${isCreating}`);

    const dataToSet: { [key: string]: any } = {
      updatedAt: serverTimestamp(), // Always set/update this
    };

    // Carefully add fields from profileData, ensuring no 'undefined' values are explicitly set
    if (profileData.name !== undefined) dataToSet.name = profileData.name;
    
    // Email and role are typically only set on creation by auth.tsx
    if (isCreating) {
      if (profileData.email !== undefined) dataToSet.email = profileData.email;
      else throw new Error(`Email is mandatory for new user profile creation for ${userId}.`);
      
      if (profileData.role !== undefined) dataToSet.role = profileData.role;
      else throw new Error(`Role is mandatory for new user profile creation for ${userId}.`);

      dataToSet.createdAt = serverTimestamp();
      
      // Default coach fields only if role is coach AND it's a create operation
      if (profileData.role === 'coach') {
        dataToSet.subscriptionTier = profileData.subscriptionTier !== undefined ? profileData.subscriptionTier : 'free';
        dataToSet.status = profileData.status !== undefined ? profileData.status : 'pending_approval';
      }
      // For create, profileImageUrl comes from auth.tsx (can be null)
      dataToSet.profileImageUrl = profileData.profileImageUrl !== undefined ? profileData.profileImageUrl : null;

    } else { // This is an UPDATE operation from profile page
      // Only add fields if they are explicitly in profileData for an update.
      // Immutable fields like email, role, createdAt should NOT be in profileData for an update by owner.
      if (profileData.bio !== undefined) dataToSet.bio = profileData.bio;
      if (profileData.specialties !== undefined) dataToSet.specialties = profileData.specialties;
      if (profileData.keywords !== undefined) dataToSet.keywords = profileData.keywords;
      if (profileData.certifications !== undefined) dataToSet.certifications = profileData.certifications;
      
      // For optional fields that can be cleared by user sending empty string or null
      if (profileData.hasOwnProperty('location')) dataToSet.location = profileData.location || null;
      if (profileData.hasOwnProperty('websiteUrl')) dataToSet.websiteUrl = profileData.websiteUrl || null;
      if (profileData.hasOwnProperty('introVideoUrl')) dataToSet.introVideoUrl = profileData.introVideoUrl || null;
      if (profileData.hasOwnProperty('socialLinks')) dataToSet.socialLinks = profileData.socialLinks || []; // Default to empty array
      
      // For profileImageUrl on update, allow null to clear, or new URL
      if (profileData.hasOwnProperty('profileImageUrl')) dataToSet.profileImageUrl = profileData.profileImageUrl || null;

      // Admin might update subscriptionTier or status on existing doc
      if (profileData.subscriptionTier !== undefined) dataToSet.subscriptionTier = profileData.subscriptionTier;
      if (profileData.status !== undefined) dataToSet.status = profileData.status;
    }

    console.log(`[setUserProfile] FINAL data object for setDoc for user ${userId} (merge: ${!isCreating}):`, JSON.stringify(dataToSet, null, 2));
    
    await setDoc(userDocRef, dataToSet, { merge: !isCreating }); // Create if new, merge if updating
    
    console.log(`[setUserProfile] User profile data written successfully for user: ${userId}. Operation: ${isCreating ? 'CREATE' : 'UPDATE'}`);

  } catch (error) {
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
  console.log(`[getFeaturedCoaches] Fetching up to ${count} approved, featured coaches...`);
  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", "coach"),
      where("status", "==", "approved"),
      // orderBy("name", "asc"), // Temporarily removed for debugging permission error
      firestoreLimit(count)
    );
    console.log("[getFeaturedCoaches] Executing Firestore query:", q);
    const querySnapshot = await getDocs(q);
    console.log(`[getFeaturedCoaches] Firestore query returned ${querySnapshot.docs.length} documents.`);
    
    const coaches = querySnapshot.docs.map(docSnapshot => {
      const coachData = mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
      // console.log(`[getFeaturedCoaches] Mapped coach: ${coachData.name}, ID: ${coachData.id}, Status: ${coachData.status}, Source: ${coachData.dataSource}`);
      return coachData;
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
    
    // qConstraints.push(orderBy("name", "asc")); // Temporarily removed for debugging permission error
    qConstraints.push(firestoreLimit(50)); 

    const coachesQuery = query(collection(db, "users"), ...qConstraints);

    console.log("[getAllCoaches] Executing Firestore query for coaches:", coachesQuery);
    const querySnapshot = await getDocs(coachesQuery);
    console.log(`[getAllCoaches] Firestore query returned ${querySnapshot.docs.length} coaches initially.`);
    
    let allCoaches = querySnapshot.docs.map(docSnapshot => {
      return mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
    });

    // Client-side sorting if orderBy("name") was removed from query
    // if (!qConstraints.some(c => c.toString().includes('orderBy("name"'))) {
      allCoaches.sort((a, b) => a.name.localeCompare(b.name));
      console.log("[getAllCoaches] Applied client-side sort by name (as orderBy was temporarily removed).");
    // }

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
  } catch (error: any) {
    console.error(`[getFirestoreBlogPostBySlug] Error getting blog post by slug ${slug}:`, error.code, error.message, error);
    if (error.code === 'failed-precondition') {
      console.error("[getFirestoreBlogPostBySlug] This is likely a missing/incorrect index for query on 'blogs' collection: (slug ASC). Please create this index in Firestore.");
    }
    return null;
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
  } catch (error: any) {
    console.error("[getAllBlogPostsForAdmin] Error getting all blog posts for admin:", error.code, error.message);
     if (error.code === 'failed-precondition') { 
        console.error("[getAllBlogPostsForAdmin] This is likely a missing/incorrect index for query on 'blogs' collection: (createdAt DESC). Please create this index in Firestore.");
    }
    return [];
  }
}

export async function getMyBlogPosts(authorId: string, count = 50): Promise<BlogPost[]> {
  if (!authorId) return [];
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
  if (!authorId) return [];
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
    return newMessageRef.id;
  } catch (error: any) {
    console.error("[sendMessage] Error sending message:", error.code, error.message, error);
    console.error("[sendMessage] Data that was attempted:", JSON.stringify(messageData, null, 2));
    throw error;
  }
}

export async function getMessagesForUser(userId: string, specificOtherPartyId?: string): Promise<MessageType[]> {
  console.log(`[getMessagesForUser] Fetching messages for user: ${userId}. Specific other party: ${specificOtherPartyId || 'None'}`);
  if (!userId) {
    console.error("[getMessagesForUser] No userId provided. Returning empty array.");
    return [];
  }

  const messagesRef = collection(db, "messages");
  const allMessages: MessageType[] = [];
  const messageIdsToMarkRead: string[] = [];

  // Query for messages sent by the user to the specific other party (if provided) or to anyone
  const sentQueryConstraints = [where("senderId", "==", userId), orderBy("timestamp", "desc"), firestoreLimit(50)];
  if (specificOtherPartyId) sentQueryConstraints.push(where("recipientId", "==", specificOtherPartyId));
  const sentQuery = query(messagesRef, ...sentQueryConstraints);
  console.log(`[getMessagesForUser] Querying sent messages for ${userId}:`, sentQuery);

  try {
    const sentSnapshot = await getDocs(sentQuery);
    console.log(`[getMessagesForUser] Fetched ${sentSnapshot.docs.length} messages sent by ${userId}.`);
    sentSnapshot.forEach(docSnap => {
      allMessages.push(mapMessageFromFirestore(docSnap.data(), docSnap.id, userId));
    });
  } catch (error: any) {
    console.error(`[getMessagesForUser] Error fetching SENT messages for user ${userId}:`, error.code, error.message, error);
    // If specificOtherPartyId is present, this individual query failing might not be fatal if the received query works.
    if (!specificOtherPartyId) throw error; // Re-throw if it's a general fetch
  }

  // Query for messages received by the user from the specific other party (if provided) or from anyone
  const receivedQueryConstraints = [where("recipientId", "==", userId), orderBy("timestamp", "desc"), firestoreLimit(50)];
  if (specificOtherPartyId) receivedQueryConstraints.push(where("senderId", "==", specificOtherPartyId));
  const receivedQuery = query(messagesRef, ...receivedQueryConstraints);
  console.log(`[getMessagesForUser] Querying received messages for ${userId}:`, receivedQuery);

  try {
    const receivedSnapshot = await getDocs(receivedQuery);
    console.log(`[getMessagesForUser] Fetched ${receivedSnapshot.docs.length} messages received by ${userId}.`);
    receivedSnapshot.forEach(docSnap => {
      const msg = mapMessageFromFirestore(docSnap.data(), docSnap.id, userId);
      allMessages.push(msg);
      // If fetching for a specific conversation thread, mark received messages as read
      if (specificOtherPartyId && msg.senderId === specificOtherPartyId && !msg.read) {
        messageIdsToMarkRead.push(msg.id);
      }
    });
  } catch (error: any) {
    console.error(`[getMessagesForUser] Error fetching RECEIVED messages for user ${userId}:`, error.code, error.message, error);
    // If specificOtherPartyId is present, this individual query failing might not be fatal if the sent query works.
    if (!specificOtherPartyId) throw error; // Re-throw if it's a general fetch
  }
  
  // Deduplicate messages (in case a message was fetched by both queries, though unlikely with current logic)
  const uniqueMessages = Array.from(new Map(allMessages.map(msg => [msg.id, msg])).values());
  uniqueMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()); // Sort oldest to newest for thread display
  
  console.log(`[getMessagesForUser] Processed ${uniqueMessages.length} total unique messages for user ${userId}.`);

  // Mark messages as read if for a specific conversation
  if (messageIdsToMarkRead.length > 0) {
    console.log(`[getMessagesForUser] Attempting to mark ${messageIdsToMarkRead.length} messages as read for user ${userId}, other party ${specificOtherPartyId}`);
    try {
      const batch = writeBatch(db);
      messageIdsToMarkRead.forEach(messageId => {
        const messageRef = doc(db, "messages", messageId);
        batch.update(messageRef, { read: true });
      });
      await batch.commit();
      console.log(`[getMessagesForUser] Marked ${messageIdsToMarkRead.length} messages as read.`);
    } catch (readError: any) {
      // Log error but don't fail the whole message fetching if marking read fails
      console.error(`[getMessagesForUser] Error marking messages as read for user ${userId}:`, readError.code, readError.message);
    }
  }

  return uniqueMessages.slice(-100); // Return up to 100 most recent messages for combined view, ensure sorted correctly
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
             console.error(`[getCoachBlogStats] Index missing for query on 'blogs': authorId == ${authorId} AND status IN [draft, pending_approval]`);
             console.error(`[getCoachBlogStats] OR Index missing for query on 'blogs': authorId == ${authorId} AND status == published`);
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
