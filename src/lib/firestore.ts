
import {
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs,
  serverTimestamp, limit as firestoreLimit, updateDoc, where, deleteDoc, writeBatch, runTransaction, collectionGroup, getCountFromServer,
  Timestamp, arrayUnion, arrayRemove, documentId
} from "firebase/firestore";
import { db } from "./firebase";
import type { FirestoreUserProfile, FirestoreBlogPost, Coach, BlogPost, UserRole, CoachStatus, Message as MessageType, FirestoreMessage } from '@/types';

// --- Helper Function to Generate Conversation ID ---
const generateConversationId = (userId1: string, userId2: string): string => {
  if (!userId1 || !userId2) {
    console.error("[generateConversationId] One or both user IDs are undefined/empty. userId1:", userId1, "userId2:", userId2);
    return `error_invalid_user_ids_for_conv_id_${String(userId1)}_vs_${String(userId2)}`;
  }
  const ids = [userId1, userId2].sort();
  return ids.join('_');
};

// --- Utility to remove undefined fields ---
function pruneUndefined<T extends object>(obj: T): Partial<T> {
  return Object.entries(obj)
    .filter(([_, v]) => v !== undefined)
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}) as Partial<T>;
}

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
    availability: data.availability || [],
    subscriptionTier: data.subscriptionTier || 'free',
    status: data.status || 'pending_approval',
    websiteUrl: data.websiteUrl === undefined ? null : data.websiteUrl,
    introVideoUrl: data.introVideoUrl === undefined ? null : data.introVideoUrl,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
    dataSource: 'Firestore',
    isFeaturedOnHomepage: data.isFeaturedOnHomepage || false,
  };
};

const mapBlogPostFromFirestore = (docData: any, id: string): BlogPost => {
  const data = docData as Partial<FirestoreBlogPost>;
  let createdAtString: string;
  if (data.createdAt && typeof (data.createdAt as any).toDate === 'function') {
    createdAtString = (data.createdAt as Timestamp).toDate().toISOString();
  } else if (data.createdAt instanceof Date) {
    createdAtString = data.createdAt.toISOString();
  } else if (typeof data.createdAt === 'string') {
    const parsedDate = new Date(data.createdAt);
    if (!isNaN(parsedDate.getTime())) {
      createdAtString = parsedDate.toISOString();
    } else {
      console.warn(`[mapBlogPostFromFirestore] Invalid date string for createdAt for post ID ${id}: "${data.createdAt}". Using current date as fallback.`);
      createdAtString = new Date().toISOString();
    }
  } else {
    console.warn(`[mapBlogPostFromFirestore] createdAt is missing or invalid for post ID ${id}. Using current date as fallback.`);
    createdAtString = new Date().toISOString();
  }
  let updatedAtString: string | undefined = undefined;
  if (data.updatedAt && typeof (data.updatedAt as any).toDate === 'function') {
    updatedAtString = (data.updatedAt as Timestamp).toDate().toISOString();
  } else if (data.updatedAt instanceof Date) {
    updatedAtString = data.updatedAt.toISOString();
  } else if (typeof data.updatedAt === 'string') {
    const parsedDate = new Date(data.updatedAt);
    if (!isNaN(parsedDate.getTime())) {
      updatedAtString = parsedDate.toISOString();
    } else {
      console.warn(`[mapBlogPostFromFirestore] Invalid date string for updatedAt for post ID ${id}: "${data.updatedAt}".`);
    }
  }
  return {
    id,
    slug: data.slug || id,
    title: data.title || 'Untitled Post',
    content: data.content || '',
    excerpt: data.excerpt || '',
    authorId: data.authorId || 'unknown_author',
    authorName: data.authorName || 'Unknown Author',
    createdAt: createdAtString,
    updatedAt: updatedAtString,
    status: data.status || 'draft',
    tags: data.tags || [],
    featuredImageUrl: data.featuredImageUrl === null ? undefined : (data.featuredImageUrl || undefined),
    dataAiHint: data.dataAiHint,
  };
};

const mapMessageFromFirestore = (docData: any, id: string): MessageType => {
  const data = docData as Partial<FirestoreMessage> & { senderId: string; recipientId: string; timestamp: Timestamp; };
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
  if (!userId) throw new Error("User ID is required to set user profile.");
  const userDocRef = doc(db, "users", userId);
  const userSnap = await getDoc(userDocRef);
  const isCreating = !userSnap.exists();
  const dataToSet: { [key: string]: any } = { ...profileData };

  if (isCreating) {
    if (!dataToSet.email || !dataToSet.role || !dataToSet.name) throw new Error("Essential fields (name, email, role) missing for new user profile.");
    dataToSet.createdAt = serverTimestamp();
    dataToSet.profileImageUrl = dataToSet.profileImageUrl ?? null;
    dataToSet.enableNotifications = dataToSet.enableNotifications ?? true; // Default for new users
    dataToSet.favoriteCoachIds = dataToSet.favoriteCoachIds ?? []; // Initialize favoriteCoachIds

    if (dataToSet.role === 'coach') {
      dataToSet.subscriptionTier = dataToSet.subscriptionTier ?? 'free';
      dataToSet.status = 'active';
      dataToSet.availability = dataToSet.availability ?? [];
      dataToSet.isFeaturedOnHomepage = dataToSet.isFeaturedOnHomepage ?? false;
    }
  } else {
    dataToSet.profileImageUrl = profileData.profileImageUrl === undefined ? userSnap.data()?.profileImageUrl : (profileData.profileImageUrl ?? null);
    dataToSet.location = profileData.location === undefined ? userSnap.data()?.location : (profileData.location ?? null);
    dataToSet.websiteUrl = profileData.websiteUrl === undefined ? userSnap.data()?.websiteUrl : (profileData.websiteUrl ?? null);
    dataToSet.introVideoUrl = profileData.introVideoUrl === undefined ? userSnap.data()?.introVideoUrl : (profileData.introVideoUrl ?? null);
    
    if (profileData.role === 'coach') { 
        if (profileData.isFeaturedOnHomepage === undefined) {
            dataToSet.isFeaturedOnHomepage = userSnap.data()?.isFeaturedOnHomepage ?? false;
        }
    }
  }
  dataToSet.updatedAt = serverTimestamp();

  const cleanData = pruneUndefined(dataToSet);

  await setDoc(userDocRef, cleanData, { merge: !isCreating });
}

export async function getUserProfile(userId: string): Promise<FirestoreUserProfile | null> {
  if (!userId) return null;
  const userDocRef = doc(db, "users", userId);
  const userSnap = await getDoc(userDocRef);
  if (userSnap.exists()) {
    const data = userSnap.data();
    return {
      id: userSnap.id,
      ...data,
      availability: data.availability || [],
      isFeaturedOnHomepage: data.role === 'coach' ? (data.isFeaturedOnHomepage || false) : undefined,
      favoriteCoachIds: data.favoriteCoachIds || [], 
      enableNotifications: data.enableNotifications === undefined ? true : data.enableNotifications,
    } as FirestoreUserProfile;
  }
  return null;
}

export async function getAllUserProfilesForAdmin(): Promise<FirestoreUserProfile[]> {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : (data.updatedAt || new Date().toISOString()),
      isFeaturedOnHomepage: data.role === 'coach' ? (data.isFeaturedOnHomepage || false) : undefined,
      favoriteCoachIds: data.favoriteCoachIds || [],
      enableNotifications: data.enableNotifications === undefined ? true : data.enableNotifications,
    } as FirestoreUserProfile;
  });
}

export async function suspendUserAccount(userId: string): Promise<void> {
  if (!userId) {
    throw new Error("User ID is required to suspend account.");
  }
  const userDocRef = doc(db, "users", userId);
  await updateDoc(userDocRef, { status: 'suspended' });
}

export async function unsuspendUserAccount(userId: string): Promise<void> {
  if (!userId) {
    throw new Error("User ID is required to unsuspend account.");
  }
  const userDocRef = doc(db, "users", userId);
  await updateDoc(userDocRef, { status: 'active' });
}

// --- Coach Fetching Functions ---
export async function getFeaturedCoaches(count = 3): Promise<Coach[]> {
  const q = query(
    collection(db, "users"),
    where("role", "==", "coach"),
    where("isFeaturedOnHomepage", "==", true),
    firestoreLimit(count)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnapshot => mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id));
}

export async function getAllCoaches(filters?: { searchTerm?: string }): Promise<Coach[]> {
  const qConstraints = [where("role", "==", "coach"), firestoreLimit(50)];
  const coachesQuery = query(collection(db, "users"), ...qConstraints);
  const querySnapshot = await getDocs(coachesQuery);
  let allCoaches = querySnapshot.docs.map(docSnapshot => mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id));
  if (filters?.searchTerm) {
    const lowerSearchTerm = filters.searchTerm.toLowerCase();
    allCoaches = allCoaches.filter(coach =>
      coach.name.toLowerCase().includes(lowerSearchTerm) ||
      (coach.bio && coach.bio.toLowerCase().includes(lowerSearchTerm)) ||
      (Array.isArray(coach.specialties) && coach.specialties.some(s => s.toLowerCase().includes(lowerSearchTerm))) ||
      (() => {
        const keywordsArray = Array.isArray(coach.keywords)
          ? coach.keywords
          : (typeof coach.keywords === 'string' ? coach.keywords.split(',').map(k => k.trim()).filter(Boolean) : []);
        return keywordsArray.some(k => k.toLowerCase().includes(lowerSearchTerm));
      })()
    );
  }
  return allCoaches;
}

export async function getCoachById(coachId: string): Promise<Coach | null> {
  if (!coachId) return null;
  const userProfile = await getUserProfile(coachId);
  if (userProfile && userProfile.role === 'coach') return mapCoachFromFirestore(userProfile, userProfile.id);
  return null;
}

export async function getAllCoachIds(): Promise<string[]> {
  try {
    const q = query(collection(db, "users"), where("role", "==", "coach"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnapshot => docSnapshot.id);
  } catch (error) {
    console.error("Failed to fetch coach IDs for static generation:", error);
    return [];
  }
}

export async function updateCoachSubscriptionTier(coachId: string, tier: 'free' | 'premium'): Promise<void> {
  if (!coachId) throw new Error("Coach ID is required.");
  await updateDoc(doc(db, "users", coachId), {
    subscriptionTier: tier,
    updatedAt: serverTimestamp()
  });
}

export async function updateCoachStatus(coachId: string, status: CoachStatus): Promise<void> {
  if (!coachId) throw new Error("Coach ID is required.");
  await updateDoc(doc(db, "users", coachId), {
    status: status,
    updatedAt: serverTimestamp()
  });
}

export async function updateCoachFeatureStatus(coachId: string, isFeatured: boolean): Promise<void> {
  if (!coachId) {
    throw new Error("Coach ID is required to update feature status.");
  }
  const coachRef = doc(db, "users", coachId);
  await updateDoc(coachRef, {
    isFeaturedOnHomepage: isFeatured,
    updatedAt: serverTimestamp()
  });
}

// --- Blog Post Functions ---
export async function createFirestoreBlogPost(postData: { title: string; content: string; status: 'draft' | 'pending_approval'; authorId: string; authorName: string; excerpt?: string; tags?: string; featuredImageUrl?: string; slug?: string; }): Promise<string> {
  const blogsCollection = collection(db, "blogs");
  const slug = postData.slug || (postData.title ? postData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') : `post-${Date.now()}`);
  const tagsArray = postData.tags ? postData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [];
  const dataToSave: Omit<FirestoreBlogPost, 'id'> = {
    ...postData,
    slug,
    tags: tagsArray,
    featuredImageUrl: postData.featuredImageUrl || null,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };
  const newPostRef = await addDoc(blogsCollection, dataToSave);
  return newPostRef.id;
}

export async function updateFirestoreBlogPost(postId: string, postData: Partial<Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'authorId' | 'authorName' | 'slug'>>) {
  const dataToUpdate: any = { ...postData, updatedAt: serverTimestamp() };
  if (postData.tags !== undefined) {
    dataToUpdate.tags = Array.isArray(postData.tags) ? postData.tags.map(tag => tag.trim()).filter(Boolean) : [];
  }
  if (postData.hasOwnProperty('featuredImageUrl')) {
    dataToUpdate.featuredImageUrl = postData.featuredImageUrl || null;
  }
  await updateDoc(doc(db, "blogs", postId), dataToUpdate);
}

export async function getFirestoreBlogPost(postId: string): Promise<BlogPost | null> {
  const postDoc = await getDoc(doc(db, "blogs", postId));
  return postDoc.exists() ? mapBlogPostFromFirestore(postDoc.data(), postDoc.id) : null;
}

export async function getFirestoreBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const q = query(collection(db, "blogs"), where("slug", "==", slug), firestoreLimit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) return mapBlogPostFromFirestore(querySnapshot.docs[0].data(), querySnapshot.docs[0].id);
  return null;
}

export async function getPublishedBlogPosts(count: number | null = 10): Promise<BlogPost[]> {
    const queryConstraints: any[] = [
        where("status", "==", "published"),
        orderBy("createdAt", "desc")
    ];

    if (typeof count === 'number' && count > 0) {
        queryConstraints.push(firestoreLimit(count));
    }

    const q = query(collection(db, "blogs"), ...queryConstraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
}

export async function getAllPublishedBlogPostSlugs(): Promise<string[]> {
  try {
    const q = query(collection(db, "blogs"), where("status", "==", "published"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnapshot => (docSnapshot.data() as FirestoreBlogPost).slug).filter(Boolean);
  } catch (error) {
    console.error("Failed to fetch blog slugs for static generation:", error);
    return [];
  }
}

export async function updateBlogPostStatus(postId: string, status: FirestoreBlogPost['status']): Promise<void> {
  await updateDoc(doc(db, "blogs", postId), { status: status, updatedAt: serverTimestamp() });
}

export async function deleteFirestoreBlogPost(postId: string): Promise<void> {
  await deleteDoc(doc(db, "blogs", postId));
}

export async function getAllBlogPostsForAdmin(count = 50): Promise<BlogPost[]> {
  const q = query(collection(db, "blogs"), orderBy("createdAt", "desc"), firestoreLimit(count));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
}

export async function getMyBlogPosts(authorId: string, count = 50): Promise<BlogPost[]> {
  if (!authorId) return [];
  const q = query(collection(db, "blogs"), where("authorId", "==", authorId), orderBy("createdAt", "desc"), firestoreLimit(count));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
}

export async function getBlogPostsByAuthor(authorId: string, count = 2): Promise<BlogPost[]> {
  if (!authorId) return [];
  const q = query(collection(db, "blogs"), where("authorId", "==", authorId), where("status", "==", "published"), orderBy("createdAt", "desc"), firestoreLimit(count));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnap => mapBlogPostFromFirestore(docSnap.data(), docSnap.id));
}

// --- Messaging Functions ---
export async function sendMessage(messageData: Omit<FirestoreMessage, 'id' | 'timestamp' | 'read' | 'conversationId'>): Promise<string> {
  if (!messageData.senderId || !messageData.recipientId || !messageData.content || !messageData.senderName || !messageData.recipientName) {
    throw new Error("Sender ID, Recipient ID, content, sender name, and recipient name are required.");
  }
  if (messageData.senderId === messageData.recipientId) throw new Error("Sender and recipient cannot be the same person.");
  const conversationId = generateConversationId(messageData.senderId, messageData.recipientId);
  if (conversationId.startsWith('error_invalid_user_ids_for_conv_id')) {
    throw new Error("Failed to send message due to invalid user IDs for conversation ID generation.");
  }
  const messagesCollection = collection(db, "messages");
  const messageToSend: Omit<FirestoreMessage, 'id'> = { ...messageData, conversationId, timestamp: serverTimestamp() as Timestamp, read: false };
  const newMessageRef = await addDoc(messagesCollection, messageToSend);
  return newMessageRef.id;
}

export async function markMessagesAsRead(messageIdsToMark: string[], currentUserId: string): Promise<void> {
  if (!messageIdsToMark || messageIdsToMark.length === 0 || !currentUserId) return;
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
    } catch (error) { console.error("[markMessagesAsRead] Error processing message ID:", messageId, error); }
  }
  if (actuallyMarkedCount > 0) await batch.commit();
}

export async function getMessagesForUser(userId: string, otherPartyId?: string | null, messageLimit = 30): Promise<MessageType[]> {
  if (!userId) return [];
  const messagesRef = collection(db, "messages");
  const allMessagesMap = new Map<string, MessageType>();
  const messageIdsToMarkReadClientSide: string[] = [];
  const commonQueryParts = [orderBy("timestamp", "desc"), firestoreLimit(messageLimit)];

  const sentQueryConstraints = [where("senderId", "==", userId), ...commonQueryParts];
  if (otherPartyId) sentQueryConstraints.splice(1, 0, where("recipientId", "==", otherPartyId));
  const qSent = query(messagesRef, ...sentQueryConstraints);
  const sentSnapshot = await getDocs(qSent);
  sentSnapshot.forEach(docSnap => allMessagesMap.set(docSnap.id, mapMessageFromFirestore(docSnap.data(), docSnap.id)));

  const receivedQueryConstraints = [where("recipientId", "==", userId), ...commonQueryParts];
  if (otherPartyId) receivedQueryConstraints.splice(1, 0, where("senderId", "==", otherPartyId));
  const qReceived = query(messagesRef, ...receivedQueryConstraints);
  const receivedSnapshot = await getDocs(qReceived);
  receivedSnapshot.forEach(docSnap => {
    const msg = mapMessageFromFirestore(docSnap.data(), docSnap.id);
    if (!allMessagesMap.has(docSnap.id)) allMessagesMap.set(docSnap.id, msg);
    if (otherPartyId && !msg.read && msg.recipientId === userId) messageIdsToMarkReadClientSide.push(msg.id);
  });

  if (otherPartyId && messageIdsToMarkReadClientSide.length > 0) {
    markMessagesAsRead(messageIdsToMarkReadClientSide, userId).catch(err => console.error("[getMessagesForUser] Background markMessagesAsRead failed:", err));
  }
  const combinedMessages = Array.from(allMessagesMap.values());
  combinedMessages.sort((a, b) => otherPartyId ? new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return combinedMessages.slice(0, otherPartyId ? undefined : 50);
}

export async function getMessagesForConversation(conversationId: string): Promise<MessageType[]> {
    if (!conversationId) {
        console.error("getMessagesForConversation: conversationId is required.");
        return [];
    }
    const messagesRef = collection(db, "messages");
    const q = query(messagesRef, where("conversationId", "==", conversationId), orderBy("timestamp", "asc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnapshot => mapMessageFromFirestore(docSnapshot.data(), docSnapshot.id));
}

export async function getAllMessagesForAdmin(count = 50): Promise<MessageType[]> {
  const messagesCollection = collection(db, "messages");
  const q = query(messagesCollection, orderBy("timestamp", "desc"), firestoreLimit(count));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(docSnapshot => mapMessageFromFirestore(docSnapshot.data(), docSnapshot.id));
}

export async function getUserUnreadMessageCount(userId: string): Promise<number> {
  if (!userId) {
    console.warn("[getUserUnreadMessageCount] No userId provided, returning 0.");
    return 0;
  }
  try {
    const messagesRef = collection(db, "messages");
    const q = query(messagesRef, where("recipientId", "==", userId), where("read", "==", false));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (error) {
    console.error("[getUserUnreadMessageCount] Error fetching unread message count for user:", userId, error);
    return 0;
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

export async function getPendingBlogPostCount(): Promise<number> {
  try {
    const blogsRef = collection(db, "blogs");
    const q = query(blogsRef, where("status", "==", "pending_approval"));
    const snapshot = await getCountFromServer(q);
    console.log(`[getPendingBlogPostCount] Found ${snapshot.data().count} posts pending approval.`);
    return snapshot.data().count;
  } catch (error) {
    console.error("[getPendingBlogPostCount] Error fetching count of pending blog posts:", error);
    return 0;
  }
}

export async function getActiveSubscriptionsCount(): Promise<number> {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("role", "==", "coach"), where("subscriptionTier", "===", "premium")); // Corrected to triple equals for "premium"
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

export async function getCoachUnreadMessageCount(coachId: string): Promise<number> {
  if (!coachId) return 0;
  const messagesRef = collection(db, "messages");
  const q = query(messagesRef, where("recipientId", "==", coachId), where("read", "==", false));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

export async function getCoachBlogStats(coachId: string): Promise<{ pending: number, published: number }> {
  if (!coachId) return { pending: 0, published: 0 };
  const blogsRef = collection(db, "blogs");
  const pendingQuery = query(blogsRef, where("authorId", "==", coachId), where("status", "in", ["draft", "pending_approval"]));
  const pendingSnapshot = await getCountFromServer(pendingQuery);
  const publishedQuery = query(blogsRef, where("authorId", "==", coachId), where("status", "==", "published"));
  const publishedSnapshot = await getCountFromServer(publishedQuery);
  return { pending: pendingSnapshot.data().count, published: publishedSnapshot.data().count };
}

// --- Favorite Coach Functions ---
export async function addCoachToFavorites(userId: string, coachId: string): Promise<void> {
  if (!userId || !coachId) throw new Error("User ID and Coach ID are required.");
  const userDocRef = doc(db, "users", userId);
  await updateDoc(userDocRef, {
    favoriteCoachIds: arrayUnion(coachId),
    updatedAt: serverTimestamp()
  });
}

export async function removeCoachFromFavorites(userId: string, coachId: string): Promise<void> {
  if (!userId || !coachId) throw new Error("User ID and Coach ID are required.");
  const userDocRef = doc(db, "users", userId);
  await updateDoc(userDocRef, {
    favoriteCoachIds: arrayRemove(coachId),
    updatedAt: serverTimestamp()
  });
}

export async function getFavoriteCoaches(userId: string): Promise<Coach[]> {
  if (!userId) return [];
  const userProfile = await getUserProfile(userId);

  if (!userProfile || !Array.isArray(userProfile.favoriteCoachIds) || userProfile.favoriteCoachIds.length === 0) {
    return [];
  }

  const favoriteCoachIds = userProfile.favoriteCoachIds;
  const coaches: Coach[] = [];
  const BATCH_SIZE = 30; 

  for (let i = 0; i < favoriteCoachIds.length; i += BATCH_SIZE) {
    const batchIds = favoriteCoachIds.slice(i, i + BATCH_SIZE);
    if (batchIds.length > 0) {
      const q = query(
        collection(db, "users"),
        where(documentId(), "in", batchIds), 
        where("role", "==", "coach")
      );
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(docSnapshot => {
        if (docSnapshot.exists()) {
          coaches.push(mapCoachFromFirestore(docSnapshot.data(), docSnapshot.id));
        }
      });
    }
  }
  return coaches;
}
