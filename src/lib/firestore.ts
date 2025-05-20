// START OF CODE FOR src/lib/firestore.ts
import type { Timestamp } from "firebase/firestore";
import {
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs,
  serverTimestamp, limit as firestoreLimit, updateDoc, where, deleteDoc, writeBatch, runTransaction, collectionGroup, getCountFromServer
} from "firebase/firestore";
import { db } from "./firebase";
import type { FirestoreUserProfile, FirestoreBlogPost, Coach, BlogPost, UserRole, CoachStatus, Message as MessageType, FirestoreMessage } from '@/types';

// --- Helper Function to Generate Conversation ID ---
const generateConversationId = (userId1: string, userId2: string): string => {
  if (!userId1 || !userId2) {
    console.error("[generateConversationId] One or both user IDs are undefined/empty. userId1:", userId1, "userId2:", userId2);
    // Return a distinctly problematic ID to make it noticeable and traceable if this occurs.
    // This should ideally not happen if senderId and recipientId are always valid.
    return `error_invalid_user_ids_for_conv_id_${String(userId1)}_vs_${String(userId2)}`;
  }
  const ids = [userId1, userId2].sort();
  return ids.join('_');
};

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
  const data = docData as Partial<FirestoreMessage> & {
    senderId: string; 
    recipientId: string; 
    timestamp: Timestamp; 
  };

  let conversationId = data.conversationId;
  if (!conversationId && data.senderId && data.recipientId) {
    console.warn(`[mapMessageFromFirestore] Message ID ${id} is missing conversationId in Firestore. Generating fallback.`);
    conversationId = generateConversationId(data.senderId, data.recipientId);
  } else if (!conversationId) {
    console.error(`[mapMessageFromFirestore] Message ID ${id} is missing conversationId AND senderId/recipientId, cannot generate fallback. Assigning problematic ID.`);
    conversationId = `error_missing_conv_id_and_cannot_generate_${id}`;
  }

  return {
    id, 
    conversationId: conversationId!, 
    senderId: data.senderId!,
    senderName: data.senderName || 'Unknown Sender',
    recipientId: data.recipientId!,
    recipientName: data.recipientName || 'Unknown Recipient',
    content: data.content || '',
    timestamp: data.timestamp.toDate().toISOString(),
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

    if (profileData.name !== undefined) dataToSet.name = profileData.name;
    
    if (isCreating) {
      if (profileData.email === undefined || profileData.role === undefined || profileData.name === undefined) {
        console.error("[setUserProfile] CRITICAL: Missing essential fields (name, email, or role) for new user profile:", profileData);
        throw new Error("Essential fields (name, email, role) missing for new user profile.");
      }
      dataToSet.email = profileData.email;
      dataToSet.role = profileData.role;
      dataToSet.createdAt = serverTimestamp();
      if (profileData.role === 'coach') {
        dataToSet.subscriptionTier = profileData.subscriptionTier !== undefined ? profileData.subscriptionTier : 'free';
        dataToSet.status = profileData.status !== undefined ? profileData.status : 'pending_approval';
      }
      dataToSet.profileImageUrl = profileData.profileImageUrl !== undefined ? profileData.profileImageUrl : null;

    } else { 
      if (profileData.bio !== undefined) dataToSet.bio = profileData.bio;
      if (profileData.specialties !== undefined) dataToSet.specialties = profileData.specialties;
      if (profileData.keywords !== undefined) dataToSet.keywords = profileData.keywords;
      
      dataToSet.profileImageUrl = profileData.profileImageUrl === undefined ? userSnap.data()?.profileImageUrl : (profileData.profileImageUrl || null);
      
      if (profileData.certifications !== undefined) dataToSet.certifications = profileData.certifications;
      dataToSet.location = profileData.location === undefined ? userSnap.data()?.location : (profileData.location || null);
      dataToSet.websiteUrl = profileData.websiteUrl === undefined ? userSnap.data()?.websiteUrl : (profileData.websiteUrl || null);
      dataToSet.introVideoUrl = profileData.introVideoUrl === undefined ? userSnap.data()?.introVideoUrl : (profileData.introVideoUrl || null);
      if (profileData.socialLinks !== undefined) dataToSet.socialLinks = profileData.socialLinks;

      if (profileData.subscriptionTier !== undefined) dataToSet.subscriptionTier = profileData.subscriptionTier;
      if (profileData.status !== undefined) dataToSet.status = profileData.status;
    }
    
    dataToSet.updatedAt = serverTimestamp(); 

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
    const profileData = userSnap.data();
    console.log(`[getUserProfile] Profile found for userId: ${userId}. Data:`, JSON.stringify(profileData));
    return { 
      id: userSnap.id,
      name: profileData.name || '',
      email: profileData.email || '', 
      role: profileData.role || 'user', 
      createdAt: profileData.createdAt, 
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
      firestoreLimit(count)
    ];
    const q = query(collection(db, "users"), ...qConstraints);
    const querySnapshot = await getDocs(q);
    const coaches = querySnapshot.docs.map(docSnapshot => mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id));
    console.log(`[getFeaturedCoaches] Successfully fetched and mapped ${coaches.length} featured coaches.`);
    return coaches;
  } catch (error: any) {
    console.error("[getFeaturedCoaches] Error getting featured coaches:", error.code, error.message, error);
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
    qConstraints.push(firestoreLimit(50)); 
    const coachesQuery = query(collection(db, "users"), ...qConstraints);
    const querySnapshot = await getDocs(coachesQuery);
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
    return [];
  }
}

export async function getCoachById(coachId: string): Promise<Coach | null> {
  if (!coachId) return null;
  try {
    const userProfile = await getUserProfile(coachId);
    if (userProfile && userProfile.role === 'coach') {
      return mapCoachFromFirestore(userProfile, userProfile.id);
    }
    return null;
  } catch (error: any) { return null; }
}

export async function getAllCoachIds(): Promise<string[]> {
  try {
    const q = query(collection(db, "users"), where("role", "==", "coach"), where("status", "==", "approved"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnapshot => docSnapshot.id);
  } catch (error) { return []; }
}

export async function updateCoachSubscriptionTier(coachId: string, tier: 'free' | 'premium'): Promise<void> {
  const coachDocRef = doc(db, "users", coachId);
  await updateDoc(coachDocRef, { subscriptionTier: tier, updatedAt: serverTimestamp() });
}

export async function updateCoachStatus(coachId: string, status: CoachStatus): Promise<void> {
  const coachDocRef = doc(db, "users", coachId);
  await updateDoc(coachDocRef, { status: status, updatedAt: serverTimestamp() });
}


// --- Blog Post Functions ---
export async function createFirestoreBlogPost(
  postData: {
    title: string;
    content: string;
    status: 'draft' | 'pending_approval';
    authorId: string;
    authorName: string;
    excerpt?: string;
    tags?: string; 
    featuredImageUrl?: string;
    slug?: string; 
  }
): Promise<string> {
  const blogsCollection = collection(db, "blogs"); 
  
  const slug = postData.slug || (postData.title ? postData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') : `post-${Date.now()}`);
  
  const tagsArray = postData.tags ? postData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];

  const dataToSave: Omit<FirestoreBlogPost, 'id'> = {
    title: postData.title,
    content: postData.content,
    status: postData.status,
    authorId: postData.authorId,
    authorName: postData.authorName,
    slug: slug,
    excerpt: postData.excerpt || '', 
    tags: tagsArray,
    featuredImageUrl: postData.featuredImageUrl || null, 
    createdAt: serverTimestamp() as Timestamp, 
    updatedAt: serverTimestamp() as Timestamp,
  };

  console.log("[createFirestoreBlogPost] Saving data:", JSON.stringify(dataToSave, null, 2));
  const newPostRef = await addDoc(blogsCollection, dataToSave);
  console.log("[createFirestoreBlogPost] Blog post created with ID:", newPostRef.id);
  return newPostRef.id;
}

export async function updateFirestoreBlogPost(postId: string, postData: Partial<Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'authorId' | 'authorName' | 'slug'>>) {
  const postDocRef = doc(db, "blogs", postId);
  const dataToUpdate: any = { updatedAt: serverTimestamp() };
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
}

export async function getFirestoreBlogPost(postId: string): Promise<BlogPost | null> {
  const postDocRef = doc(db, "blogs", postId);
  const postDoc = await getDoc(postDocRef);
  return postDoc.exists() ? mapBlogPostFromFirestore(postDoc.data(), postDoc.id) : null;
}

export async function getFirestoreBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const blogsCollection = collection(db, "blogs");
  const q = query(blogsCollection, where("slug", "==", slug), firestoreLimit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    return mapBlogPostFromFirestore(querySnapshot.docs[0].data(), querySnapshot.docs[0].id);
  }
  return null;
}

export async function getPublishedBlogPosts(count = 10): Promise<BlogPost[]> {
  const blogsCollection = collection(db, "blogs");
  const q = query(blogsCollection, where("status", "==", "published"), orderBy("createdAt", "desc"), firestoreLimit(count));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
}

export async function getAllPublishedBlogPostSlugs(): Promise<string[]> {
  const q = query(collection(db, "blogs"), where("status", "==", "published"));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnapshot => (docSnapshot.data() as FirestoreBlogPost).slug).filter(Boolean);
}

export async function updateBlogPostStatus(postId: string, status: FirestoreBlogPost['status']): Promise<void> {
  const postDocRef = doc(db, "blogs", postId);
  await updateDoc(postDocRef, { status: status, updatedAt: serverTimestamp() });
}

export async function deleteFirestoreBlogPost(postId: string): Promise<void> {
  const postDocRef = doc(db, "blogs", postId);
  await deleteDoc(postDocRef);
}

export async function getAllBlogPostsForAdmin(count = 50): Promise<BlogPost[]> {
  const blogsCollection = collection(db, "blogs");
  const q = query(blogsCollection, orderBy("createdAt", "desc"), firestoreLimit(count));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
}

export async function getMyBlogPosts(authorId: string, count = 50): Promise<BlogPost[]> {
  if (!authorId) return [];
  const blogsCollection = collection(db, "blogs");
  const q = query(blogsCollection, where("authorId", "==", authorId), orderBy("createdAt", "desc"), firestoreLimit(count));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
}

export async function getBlogPostsByAuthor(authorId: string, count = 2): Promise<BlogPost[]> {
  if (!authorId) return [];
  const blogsCollection = collection(db, "blogs");
  const q = query(blogsCollection, where("authorId", "==", authorId), where("status", "==", "published"), orderBy("createdAt", "desc"), firestoreLimit(count));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
}


// --- Messaging Functions ---
export async function sendMessage(
  messageData: Omit<FirestoreMessage, 'id' | 'timestamp' | 'read' | 'conversationId'>
): Promise<string> {
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

  const conversationId = generateConversationId(messageData.senderId, messageData.recipientId);
  if (conversationId.startsWith('error_invalid_user_ids_for_conv_id')) {
      console.error(`[sendMessage] Could not generate a valid conversationId for sender: ${messageData.senderId}, recipient: ${messageData.recipientId}. Aborting send.`);
      throw new Error("Failed to send message due to invalid user IDs for conversation ID generation.");
  }
  console.log(`[sendMessage] Generated conversationId: ${conversationId}`);

  try {
    const messagesCollection = collection(db, "messages");
    const messageToSend: Omit<FirestoreMessage, 'id'> = {
      ...messageData, 
      conversationId: conversationId, 
      timestamp: serverTimestamp() as Timestamp,
      read: false,
    };

    console.log("[sendMessage] Data to be sent to Firestore:", JSON.stringify(messageToSend, null, 2));
    const newMessageRef = await addDoc(messagesCollection, messageToSend);
    console.log(`[sendMessage] Message sent with ID: ${newMessageRef.id}`);
    return newMessageRef.id;
  } catch (error: any) {
    console.error("[sendMessage] Error sending message to Firestore:", error.code, error.message, error);
    console.error("[sendMessage] Data that was attempted for addDoc:", JSON.stringify(messageData, null, 2), "with generated conversationId:", conversationId);
    throw error;
  }
}

export async function markMessagesAsRead(messageIdsToMark: string[], currentUserId: string): Promise<void> {
  if (!messageIdsToMark || messageIdsToMark.length === 0) return;
  if (!currentUserId) return;
  const batch = writeBatch(db);
  let actuallyMarkedCount = 0;
  for (const messageId of messageIdsToMark) {
    const messageRef = doc(db, "messages", messageId);
    try {
      const messageSnap = await getDoc(messageRef);
      if (messageSnap.exists()) {
        const messageData = messageSnap.data() as FirestoreMessage;
        if (messageData.recipientId === currentUserId && !messageData.read) {
          batch.update(messageRef, { read: true });
          actuallyMarkedCount++;
        }
      }
    } catch (error: any) { /* ... */ }
  }
  if (actuallyMarkedCount > 0) {
    await batch.commit();
  }
}

export async function getMessagesForUser(
  userId: string,
  otherPartyId?: string | null,
  messageLimit: number = 30
): Promise<MessageType[]> {
  console.log(`[getMessagesForUser] Fetching messages. User: ${userId}, OtherParty: ${otherPartyId || 'All'}, Limit: ${messageLimit}`);
  if (!userId) return [];

  const messagesRef = collection(db, "messages");
  const allMessagesMap = new Map<string, MessageType>();
  const messageIdsToMarkReadClientSide: string[] = [];

  const sentQueryConstraints: any[] = [where("senderId", "==", userId), orderBy("timestamp", "desc"), firestoreLimit(messageLimit)];
  if (otherPartyId) {
    sentQueryConstraints.splice(1, 0, where("recipientId", "==", otherPartyId)); 
  }
  const qSent = query(messagesRef, ...sentQueryConstraints);

  try {
    const sentSnapshot = await getDocs(qSent);
    sentSnapshot.forEach(docSnap => {
      const msg = mapMessageFromFirestore(docSnap.data(), docSnap.id); 
      allMessagesMap.set(docSnap.id, msg);
    });
  } catch (error: any) { /* ... */ }

  const receivedQueryConstraints: any[] = [where("recipientId", "==", userId), orderBy("timestamp", "desc"), firestoreLimit(messageLimit)];
  if (otherPartyId) {
    receivedQueryConstraints.splice(1, 0, where("senderId", "==", otherPartyId)); 
  }
  const qReceived = query(messagesRef, ...receivedQueryConstraints);

  try {
    const receivedSnapshot = await getDocs(qReceived);
    receivedSnapshot.forEach(docSnap => {
      const msg = mapMessageFromFirestore(docSnap.data(), docSnap.id); 
      if (!allMessagesMap.has(docSnap.id)) { 
        allMessagesMap.set(docSnap.id, msg);
      }
      if (otherPartyId && !msg.read && msg.recipientId === userId) {
        messageIdsToMarkReadClientSide.push(msg.id);
      }
    });
  } catch (error: any) { /* ... */ }
  
  if (otherPartyId && messageIdsToMarkReadClientSide.length > 0) {
    markMessagesAsRead(messageIdsToMarkReadClientSide, userId).catch(err => console.error("[getMessagesForUser] Background markMessagesAsRead failed:", err));
  }
  
  const combinedMessages = Array.from(allMessagesMap.values());
  combinedMessages.sort((a, b) => 
    otherPartyId 
      ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  return combinedMessages.slice(0, otherPartyId ? undefined : 50);
}

// NEW FUNCTION for Admin Message Logs
export async function getAllMessagesForAdmin(count = 50): Promise<MessageType[]> {
  console.log(`[getAllMessagesForAdmin] Fetching up to ${count} messages for admin...`);
  try {
    const messagesCollection = collection(db, "messages");
    const q = query(messagesCollection, orderBy("timestamp", "desc"), firestoreLimit(count));
    const querySnapshot = await getDocs(q);
    const messages = querySnapshot.docs.map(docSnapshot => 
      mapMessageFromFirestore(docSnapshot.data(), docSnapshot.id) 
    );
    console.log(`[getAllMessagesForAdmin] Successfully fetched and mapped ${messages.length} messages.`);
    return messages;
  } catch (error: any) {
    console.error("[getAllMessagesForAdmin] Error getting messages for admin:", error.code, error.message, error);
    return []; 
  }
}


// --- Admin Dashboard Stats ---
export async function getPendingCoachCount(): Promise<number> {
  const coachesRef = collection(db, "users");
  const q = query(coachesRef, where("role", "==", "coach"), where("status", "==", "pending_approval"));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

export async function getTotalCoachCount(): Promise<number> {
  const coachesRef = collection(db, "users");
  const q = query(coachesRef, where("role", "==", "coach"));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

export async function getTotalUserCount(): Promise<number> {
  const usersRef = collection(db, "users");
  const snapshot = await getCountFromServer(usersRef);
  return snapshot.data().count;
}

export async function getTotalMessagesCount(): Promise<number> {
  const messagesRef = collection(db, "messages");
  const snapshot = await getCountFromServer(messagesRef);
  return snapshot.data().count;
}

export async function getTotalBlogPostsCount(): Promise<number> {
  const blogsRef = collection(db, "blogs");
  const snapshot = await getCountFromServer(blogsRef);
  return snapshot.data().count;
}

export async function getActiveSubscriptionsCount(): Promise<number> {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("role", "==", "coach"), where("subscriptionTier", "===", "premium"));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}
