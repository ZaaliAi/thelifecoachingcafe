
import type { Timestamp } from "firebase/firestore";
import {
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs,
  serverTimestamp, limit as firestoreLimit, updateDoc, where, deleteDoc, writeBatch, runTransaction, collectionGroup, getCountFromServer
} from "firebase/firestore";
import { db } from "./firebase";
import type { FirestoreUserProfile, FirestoreBlogPost, Coach, BlogPost, UserRole, CoachStatus, Message as MessageType, FirestoreMessage } from '@/types';

// --- Helper Functions for Data Mapping ---
const mapCoachFromFirestore = (docData: any, id: string): Coach => {
  console.log(`[mapCoachFromFirestore] Mapping data for coach ID: ${id}`, docData);
  const data = docData as Omit<FirestoreUserProfile, 'id'> & { createdAt?: Timestamp, updatedAt?: Timestamp, status?: CoachStatus };
  return {
    id,
    name: data.name || 'Unnamed Coach',
    email: data.email, // Email should exist on FirestoreUserProfile
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

const mapMessageFromFirestore = (docData: any, id: string): MessageType => {
  const data = docData as Omit<FirestoreMessage, 'id'> & { timestamp: Timestamp };
  return {
    id,
    senderId: data.senderId,
    senderName: data.senderName || 'Unknown Sender',
    recipientId: data.recipientId,
    recipientName: data.recipientName || 'Unknown Recipient',
    content: data.content,
    timestamp: data.timestamp.toDate().toISOString(), // Convert Firestore Timestamp to ISO string
    read: data.read || false,
  };
};


// --- User Profile Functions ---
export async function setUserProfile(userId: string, profileData: Partial<Omit<FirestoreUserProfile, 'id'>>) {
  console.log(`[setUserProfile] Called for user: ${userId}. Initial profileData:`, JSON.stringify(profileData, null, 2));

  if (!userId) {
    console.error("[setUserProfile] CRITICAL: userId is undefined or null. Profile cannot be saved.");
    throw new Error("User ID is required to set user profile.");
  }

  const userDocRef = doc(db, "users", userId);

  try {
    const userSnap = await getDoc(userDocRef);
    const isCreating = !userSnap.exists();
    console.log(`[setUserProfile] Is creating new document for ${userId}: ${isCreating}`);

    const dataToSet: { [key: string]: any } = {};

    // Populate dataToSet carefully, only with fields present in profileData or defaults for creation
    if (profileData.name !== undefined) dataToSet.name = profileData.name;
    
    // Email and Role are typically set only on creation from auth context, not updated by user profile forms
    if (isCreating) {
      if (profileData.email === undefined || profileData.role === undefined || profileData.name === undefined) {
        console.error("[setUserProfile] CRITICAL: Missing essential fields (name, email, or role) for new user profile:", profileData);
        throw new Error("Essential fields (name, email, role) missing for new user profile.");
      }
      dataToSet.email = profileData.email;
      dataToSet.role = profileData.role;
      dataToSet.createdAt = serverTimestamp();
      // Set defaults for coaches on creation if not explicitly provided
      if (profileData.role === 'coach') {
        dataToSet.subscriptionTier = profileData.subscriptionTier !== undefined ? profileData.subscriptionTier : 'free';
        dataToSet.status = profileData.status !== undefined ? profileData.status : 'pending_approval';
      }
      // Handle profileImageUrl specifically for create - it comes from auth.tsx
      dataToSet.profileImageUrl = profileData.profileImageUrl !== undefined ? profileData.profileImageUrl : null;

    } else { // This is an update
      // For updates, only include fields that are explicitly in profileData
      // Fields like email, role, createdAt are generally not updated from user-facing profile forms
      if (profileData.bio !== undefined) dataToSet.bio = profileData.bio;
      if (profileData.specialties !== undefined) dataToSet.specialties = profileData.specialties;
      if (profileData.keywords !== undefined) dataToSet.keywords = profileData.keywords;
      
      // Handle null explicitly for optional fields that can be cleared during update
      dataToSet.profileImageUrl = profileData.profileImageUrl === undefined ? userSnap.data()?.profileImageUrl : (profileData.profileImageUrl || null);
      
      if (profileData.certifications !== undefined) dataToSet.certifications = profileData.certifications;
      dataToSet.location = profileData.location === undefined ? userSnap.data()?.location : (profileData.location || null);
      dataToSet.websiteUrl = profileData.websiteUrl === undefined ? userSnap.data()?.websiteUrl : (profileData.websiteUrl || null);
      dataToSet.introVideoUrl = profileData.introVideoUrl === undefined ? userSnap.data()?.introVideoUrl : (profileData.introVideoUrl || null);
      if (profileData.socialLinks !== undefined) dataToSet.socialLinks = profileData.socialLinks;

      // SubscriptionTier and Status are typically updated by admin, not direct user profile edit
      if (profileData.subscriptionTier !== undefined) dataToSet.subscriptionTier = profileData.subscriptionTier;
      if (profileData.status !== undefined) dataToSet.status = profileData.status;
    }
    
    dataToSet.updatedAt = serverTimestamp(); // Always set/update this

    console.log(`[setUserProfile] FINAL data object for setDoc for user ${userId} (merge: ${!isCreating}):`, JSON.stringify(dataToSet, null, 2));
    
    await setDoc(userDocRef, dataToSet, { merge: !isCreating }); // Use merge:true for updates, merge:false (or no merge) for create
    
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
    const profileData = userSnap.data();
    console.log(`[getUserProfile] Profile found for userId: ${userId}. Data:`, JSON.stringify(profileData));
    // Ensure essential fields like email and role are present, fallback if necessary (though they should be)
    return { 
      id: userSnap.id,
      name: profileData.name || '',
      email: profileData.email || '', // Should always exist
      role: profileData.role || 'user', // Default to 'user' if role is missing
      createdAt: profileData.createdAt, // Keep as Firestore Timestamp or convert as needed
      updatedAt: profileData.updatedAt,
      bio: profileData.bio,
      specialties: profileData.specialties,
      keywords: profileData.keywords,
      profileImageUrl: profileData.profileImageUrl,
      certifications: profileData.certifications,
      location: profileData.location,
      websiteUrl: profileData.websiteUrl,
      introVideoUrl: profileData.introVideoUrl,
      socialLinks: profileData.socialLinks,
      subscriptionTier: profileData.subscriptionTier,
      status: profileData.status,
      dataAiHint: profileData.dataAiHint,
    } as FirestoreUserProfile;
  }
  console.log(`[getUserProfile] No profile found for userId: ${userId}`);
  return null;
}

// --- Coach Fetching Functions ---
export async function getFeaturedCoaches(count = 3): Promise<Coach[]> {
  console.log(`[getFeaturedCoaches] Fetching up to ${count} approved, featured coaches...`);
  try {
    const qConstraints: any[] = [
      where("role", "==", "coach"),
      where("status", "==", "approved"),
      // orderBy("name", "asc"), // Temporarily removed for debugging permissions
      firestoreLimit(count)
    ];
    const q = query(collection(db, "users"), ...qConstraints);
    console.log("[getFeaturedCoaches] Executing Firestore query:", q);
    const querySnapshot = await getDocs(q);
    console.log(`[getFeaturedCoaches] Firestore query returned ${querySnapshot.docs.length} documents.`);
    
    const coaches = querySnapshot.docs.map(docSnapshot => {
      console.log(`[getFeaturedCoaches] Raw data for coach ${docSnapshot.id}:`, docSnapshot.data());
      return mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id);
    });
    console.log(`[getFeaturedCoaches] Successfully fetched and mapped ${coaches.length} featured coaches.`);
    return coaches;
  } catch (error: any) {
    console.error("[getFeaturedCoaches] Error getting featured coaches:", error.code, error.message, error);
    if (error.code === 'permission-denied' || error.code === 'failed-precondition') {
        console.error("[getFeaturedCoaches] This is likely a Firestore Security Rule issue or a missing/incorrect index (users: role ASC, status ASC, name ASC - or simpler if orderBy name is removed).");
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
    
    // qConstraints.push(orderBy("name", "asc")); // Temporarily removed for debugging permissions
    qConstraints.push(firestoreLimit(50)); 

    const coachesQuery = query(collection(db, "users"), ...qConstraints);

    console.log("[getAllCoaches] Executing Firestore query for coaches:", coachesQuery);
    const querySnapshot = await getDocs(coachesQuery);
    console.log(`[getAllCoaches] Firestore query returned ${querySnapshot.docs.length} coaches initially.`);
    
    let allCoaches = querySnapshot.docs.map(docSnapshot => {
      console.log(`[getAllCoaches] Raw data for coach ${docSnapshot.id}:`, docSnapshot.data());
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
  console.log("[sendMessage] Attempting to send message. Data provided:", JSON.stringify(messageData, null, 2));
  if (!messageData.senderId || !messageData.recipientId || !messageData.content || !messageData.senderName || !messageData.recipientName) {
    const missingFields = ['senderId', 'recipientId', 'content', 'senderName', 'recipientName'].filter(key => !(messageData as any)[key]);
    console.error(`[sendMessage] Critical data missing for sending message. Missing: ${missingFields.join(', ')}. Full data:`, messageData);
    throw new Error(`Sender ID, Recipient ID, content, sender name, and recipient name are required. Missing: ${missingFields.join(', ')}`);
  }
  if (messageData.senderId === messageData.recipientId) {
    console.error("[sendMessage] Sender and recipient cannot be the same.");
    throw new Error("Sender and recipient cannot be the same person.");
  }
  try {
    const messagesCollection = collection(db, "messages");
    const messageToSend: Omit<FirestoreMessage, 'id'> = {
      senderId: messageData.senderId,
      senderName: messageData.senderName,
      recipientId: messageData.recipientId,
      recipientName: messageData.recipientName,
      content: messageData.content,
      timestamp: serverTimestamp() as Timestamp, // This is correct
      read: false,
    };
    const newMessageRef = await addDoc(messagesCollection, messageToSend);
    console.log(`[sendMessage] Message sent with ID: ${newMessageRef.id}`);
    return newMessageRef.id;
  } catch (error: any) {
    console.error("[sendMessage] Error sending message to Firestore:", error.code, error.message, error);
    console.error("[sendMessage] Data that was attempted for addDoc:", JSON.stringify(messageData, null, 2));
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
  console.log(`[markMessagesAsRead] Attempting to mark ${messageIdsToMark.length} messages as read for user ${currentUserId}. Message IDs:`, messageIdsToMark);

  const batch = writeBatch(db);
  let actuallyMarkedCount = 0;

  for (const messageId of messageIdsToMark) {
    console.log(`[markMessagesAsRead] Processing messageId: ${messageId} for user: ${currentUserId}`);
    const messageRef = doc(db, "messages", messageId);
    try {
      // Fetch the message to ensure the current user is the recipient and it's unread
      const messageSnap = await getDoc(messageRef);
      if (messageSnap.exists()) {
        const messageData = messageSnap.data() as FirestoreMessage;
        console.log(`[markMessagesAsRead] Message ${messageId} data: recipientId=${messageData.recipientId}, read=${messageData.read}`);
        if (messageData.recipientId === currentUserId && !messageData.read) {
          batch.update(messageRef, { read: true });
          actuallyMarkedCount++;
          console.log(`[markMessagesAsRead] Added update for messageId: ${messageId} to batch.`);
        } else {
          console.log(`[markMessagesAsRead] Skipped messageId: ${messageId}. Reason: not recipient or already read. (Recipient: ${messageData.recipientId}, CurrentUser: ${currentUserId}, Read: ${messageData.read})`);
        }
      } else {
        console.warn(`[markMessagesAsRead] Message document with ID ${messageId} not found. Skipping.`);
      }
    } catch (error: any) {
       console.error(`[markMessagesAsRead] Error fetching message ${messageId} for verification before update:`, error.code, error.message, error);
       // Decide if you want to continue or stop the batch on individual fetch error
    }
  }

  if (actuallyMarkedCount > 0) {
    try {
      await batch.commit();
      console.log(`[markMessagesAsRead] Successfully committed batch to mark ${actuallyMarkedCount} messages as read.`);
    } catch (error: any) {
      console.error(`[markMessagesAsRead] Error committing batch to mark messages as read for user ${currentUserId}:`, error.code, error.message, error);
      throw error;
    }
  } else {
    console.log("[markMessagesAsRead] No messages were batched to be marked as read (either none to mark or verification failed).");
  }
};


export async function getMessagesForUser(
  userId: string,
  otherPartyId?: string | null, // Make otherPartyId optional for fetching all conversations overview
  messageLimit: number = 30 
): Promise<MessageType[]> {
  console.log(`[getMessagesForUser] Fetching messages. User: ${userId}, OtherParty: ${otherPartyId || 'All'}, Limit: ${messageLimit}`);
  if (!userId) {
    console.warn("[getMessagesForUser] No userId provided. Returning empty array.");
    return [];
  }

  const messagesRef = collection(db, "messages");
  const allMessagesMap = new Map<string, MessageType>();
  const messageIdsToMarkReadClientSide: string[] = [];

  // Query 1: Messages sent by the current user to the other party (or all if otherPartyId is null)
  const sentQueryConstraints: any[] = [where("senderId", "==", userId), orderBy("timestamp", "desc"), firestoreLimit(messageLimit)];
  if (otherPartyId) {
    sentQueryConstraints.splice(1, 0, where("recipientId", "==", otherPartyId)); 
  }
  const qSent = query(messagesRef, ...sentQueryConstraints);

  try {
    console.log(`[getMessagesForUser] Querying SENT messages for user ${userId}${otherPartyId ? ' to ' + otherPartyId : ''}... Constraints:`, JSON.stringify(sentQueryConstraints.map(c => c.toString())));
    const sentSnapshot = await getDocs(qSent);
    console.log(`[getMessagesForUser] Fetched ${sentSnapshot.docs.length} messages sent by ${userId}.`);
    sentSnapshot.forEach(docSnap => {
      const msg = mapMessageFromFirestore(docSnap.data(), docSnap.id);
      allMessagesMap.set(docSnap.id, msg);
    });
  } catch (error: any) {
    console.error(`[getMessagesForUser] Error fetching SENT messages for user ${userId}:`, error.code, error.message, error);
    // Do not throw here, try to get received messages; re-throw at the end if both fail
  }

  // Query 2: Messages received by the current user from the other party (or all if otherPartyId is null)
  const receivedQueryConstraints: any[] = [where("recipientId", "==", userId), orderBy("timestamp", "desc"), firestoreLimit(messageLimit)];
  if (otherPartyId) {
    receivedQueryConstraints.splice(1, 0, where("senderId", "==", otherPartyId)); 
  }
  const qReceived = query(messagesRef, ...receivedQueryConstraints);

  try {
    console.log(`[getMessagesForUser] Querying RECEIVED messages for user ${userId}${otherPartyId ? ' from ' + otherPartyId : ''}... Constraints:`, JSON.stringify(receivedQueryConstraints.map(c => c.toString())));
    const receivedSnapshot = await getDocs(qReceived);
    console.log(`[getMessagesForUser] Fetched ${receivedSnapshot.docs.length} messages received by ${userId}.`);
    receivedSnapshot.forEach(docSnap => {
      const msg = mapMessageFromFirestore(docSnap.data(), docSnap.id);
      if (!allMessagesMap.has(docSnap.id)) { 
        allMessagesMap.set(docSnap.id, msg);
      }
      if (otherPartyId && !msg.read && msg.recipientId === userId) {
        messageIdsToMarkReadClientSide.push(msg.id);
      }
    });
  } catch (error: any) {
    console.error(`[getMessagesForUser] Error fetching RECEIVED messages for user ${userId}:`, error.code, error.message, error);
    if (allMessagesMap.size === 0) { // Only throw if sent query also failed or returned nothing
      console.error("[getMessagesForUser] Both sent and received message queries failed or returned no results. Re-throwing error.");
      throw error;
    }
  }
  
  if (otherPartyId && messageIdsToMarkReadClientSide.length > 0) {
    console.log(`[getMessagesForUser] Triggering markMessagesAsRead for ${messageIdsToMarkReadClientSide.length} messages for user ${userId} from other party ${otherPartyId}`);
    markMessagesAsRead(messageIdsToMarkReadClientSide, userId) // Not awaiting, background task
      .catch(err => console.error("[getMessagesForUser] Background markMessagesAsRead failed:", err.code, err.message, err)); // Log original error object
  }
  
  const combinedMessages = Array.from(allMessagesMap.values());
  combinedMessages.sort((a, b) => 
    otherPartyId 
      ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() // Thread view: oldest first
      : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() // List view: newest first
  );
  
  console.log(`[getMessagesForUser] Processed ${combinedMessages.length} total unique messages for user ${userId}.`);
  return combinedMessages.slice(0, otherPartyId ? undefined : 50); // Limit total for overview
}


// --- Admin Dashboard Stats ---
export async function getPendingCoachCount(): Promise<number> {
  console.log("[getPendingCoachCount] Fetching count...");
  try {
    const q = query(collection(db, "users"), where("role", "==", "coach"), where("status", "==", "pending_approval"));
    const snapshot = await getCountFromServer(q);
    console.log("[getPendingCoachCount] Count:", snapshot.data().count);
    return snapshot.data().count;
  } catch (e: any) { console.error("Error getPendingCoachCount: ", e.code, e.message, e); return 0; }
}

export async function getPendingBlogPostCount(): Promise<number> {
  console.log("[getPendingBlogPostCount] Fetching count...");
  try {
    const q = query(collection(db, "blogs"), where("status", "==", "pending_approval"));
    const snapshot = await getCountFromServer(q);
    console.log("[getPendingBlogPostCount] Count:", snapshot.data().count);
    return snapshot.data().count;
  } catch (e: any) { console.error("Error getPendingBlogPostCount: ", e.code, e.message, e); return 0; }
}

export async function getTotalUserCount(): Promise<number> {
  console.log("[getTotalUserCount] Fetching count...");
 try {
    const q = query(collection(db, "users")); 
    const snapshot = await getCountFromServer(q);
    console.log("[getTotalUserCount] Count:", snapshot.data().count);
    return snapshot.data().count;
  } catch (e: any) { console.error("Error getTotalUserCount: ", e.code, e.message, e); return 0; }
}

export async function getTotalCoachCount(): Promise<number> {
  console.log("[getTotalCoachCount] Fetching count...");
  try {
    const q = query(collection(db, "users"), where("role", "==", "coach"), where("status", "==", "approved"));
    const snapshot = await getCountFromServer(q);
    console.log("[getTotalCoachCount] Count:", snapshot.data().count);
    return snapshot.data().count;
  } catch (e: any) { console.error("Error getTotalCoachCount: ", e.code, e.message, e); return 0; }
}

export async function getCoachBlogStats(authorId: string): Promise<{ pending: number, published: number }> {
    if (!authorId) return { pending: 0, published: 0};
    console.log(`[getCoachBlogStats] Fetching stats for coach ${authorId}...`);
    try {
        const blogsCollection = collection(db, "blogs");
        const pendingQuery = query(blogsCollection, where("authorId", "==", authorId), where("status", "in", ["draft", "pending_approval"]));
        const publishedQuery = query(blogsCollection, where("authorId", "==", authorId), where("status", "==", "published"));

        const [pendingSnapshot, publishedSnapshot] = await Promise.all([
            getCountFromServer(pendingQuery),
            getCountFromServer(publishedQuery)
        ]);
        const stats = {
            pending: pendingSnapshot.data().count,
            published: publishedSnapshot.data().count
        };
        console.log(`[getCoachBlogStats] Stats for coach ${authorId}:`, stats);
        return stats;
    } catch (error: any) {
        console.error(`Error getting blog stats for coach ${authorId}:`, error.code, error.message, error);
         if (error.code === 'failed-precondition') {
             console.error(`[getCoachBlogStats] Index missing for query on 'blogs'. Common indexes needed: (authorId ASC, status ASC) or (authorId ASC, status IN [...]).`);
        }
        return { pending: 0, published: 0 };
    }
}

export async function getCoachUnreadMessageCount(coachId: string): Promise<number> {
    if (!coachId) return 0;
    console.log(`[getCoachUnreadMessageCount] Fetching count for coach ${coachId}...`);
    try {
        const messagesCollection = collection(db, "messages");
        const q = query(messagesCollection, where("recipientId", "==", coachId), where("read", "==", false));
        const snapshot = await getCountFromServer(q);
        const count = snapshot.data().count;
        console.log(`[getCoachUnreadMessageCount] Unread messages for coach ${coachId}: ${count}`);
        return count;
    } catch (error: any) {
        console.error(`Error getting unread message count for coach ${coachId}:`, error.code, error.message, error);
        if (error.code === 'failed-precondition') {
             console.error("[getCoachUnreadMessageCount] This is likely a missing/incorrect index for query on 'messages' collection: (recipientId ASC, read ASC). Please create this index in Firestore.");
        }
        return 0;
    }
}

    