"use client";

import {
  collection,
  doc,
  addDoc,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
  where,
  Timestamp,
  updateDoc,
  setDoc,
  getDoc,
  limit,
  writeBatch // Added for markMessagesAsRead
} from "firebase/firestore";
import { db, auth } from "./firebase"; 
import { getUserProfile } from "./firestore";
import type { Message, FirestoreMessage, Conversation, FirestoreUserProfile } from '@/types';

// Helper to map FirestoreMessage to Message
const mapMessageFromFirestore = (
  docData: any, 
  id: string,
  defaultSenderName?: string | null, 
  defaultRecipientName?: string | null
): Message => {
  const data = docData as Omit<FirestoreMessage, 'id' | 'timestamp'> & { timestamp: Timestamp }; 
  return {
    id,
    senderId: data.senderId,
    recipientId: data.recipientId,
    content: data.content,
    timestamp: data.timestamp.toDate().toISOString(),
    read: data.read || false,
    senderName: defaultSenderName || data.senderName || data.senderId,
    recipientName: defaultRecipientName || data.recipientName || data.recipientId,
  };
};

export const sendMessageToFirestore = async (
  senderId: string,
  recipientId: string,
  content: string,
  senderName: string, 
  recipientName: string
): Promise<string> => {
  try {
    const messagesColRef = collection(db, "messages"); 
    const messageDoc: Omit<FirestoreMessage, 'id'> = {
      senderId,
      recipientId,
      content,
      timestamp: serverTimestamp() as Timestamp,
      senderName,
      recipientName,
      read: false,
    };
    const messageDocRef = await addDoc(messagesColRef, messageDoc);
    return messageDocRef.id;
  } catch (error) {
    console.error("Error sending message:", error);
    throw new Error("Failed to send message.");
  }
};

export const fetchConversationMessages = async (conversationId: string): Promise<Message[]> => {
  console.warn("fetchConversationMessages is a placeholder and may need implementation based on your DB structure for conversations.");
  return [];
};

export const getOrCreateConversation = async (userId1: string, userId2: string): Promise<string> => {
  if (userId1 === userId2) {
    throw new Error("Cannot create a conversation with oneself.");
  }
  const members = [userId1, userId2].sort();
  const conversationId = members.join('_'); 
  const conversationDocRef = doc(db, "conversations", conversationId);
  try {
    const docSnap = await getDoc(conversationDocRef);
    if (docSnap.exists()) {
      return conversationId;
    } else {
      const user1Profile = await getUserProfile(userId1);
      const user2Profile = await getUserProfile(userId2);
      await setDoc(conversationDocRef, {
        members,
        memberNames: [user1Profile?.name || userId1, user2Profile?.name || userId2],
        memberAvatars: [user1Profile?.profileImageUrl || null, user2Profile?.profileImageUrl || null],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: "", 
      });
      return conversationId;
    }
  } catch (error) {
    console.error("Error in getOrCreateConversation:", error);
    const docSnapRetry = await getDoc(conversationDocRef);
    if (docSnapRetry.exists()) return conversationId;
    throw new Error("Failed to get or create conversation.");
  }
};

export const getUserConversations = async (userId: string): Promise<Conversation[]> => {
  try {
    const conversationsColRef = collection(db, "conversations");
    const q = query(conversationsColRef, where("members", "array-contains", userId), orderBy("updatedAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        members: data.members,
        memberNames: data.memberNames,
        memberAvatars: data.memberAvatars,
        lastMessage: data.lastMessage || "",
        updatedAt: (data.updatedAt as Timestamp)?.toDate() || new Date(),
        createdAt: (data.createdAt as Timestamp)?.toDate() || new Date(),
        lastMessageSenderId: data.lastMessageSenderId,
      } as Conversation;
    });
  } catch (error) {
    console.error("Error fetching user conversations:", error);
    throw new Error("Failed to fetch user conversations.");
  }
};

export const fetchReceivedMessages = async (): Promise<Message[]> => {
  if (!auth.currentUser) return [];
  const messagesRef = collection(db, "messages"); 
  const q = query(messagesRef, where("recipientId", "==", auth.currentUser.uid), orderBy("timestamp", "desc"));
  const snapshot = await getDocs(q);
  return Promise.all(snapshot.docs.map(async (doc) => {
    const data = doc.data() as FirestoreMessage;
    let senderName = data.senderName;
    if (data.senderId && (senderName === data.senderId || !senderName)) {
      const profile = await getUserProfile(data.senderId);
      senderName = profile?.name || profile?.displayName || data.senderId;
    }
    return mapMessageFromFirestore(data, doc.id, senderName, data.recipientName);
  }));
};

export const getMessagesForUserOrCoach = async (userId: string, messageLimit: number = 50): Promise<Message[]> => {
  if (!userId) {
    console.warn("[getMessagesForUserOrCoach] No userId provided.");
    return [];
  }
  const messagesRef = collection(db, "messages");
  const sentMessagesQuery = query(messagesRef, where("senderId", "==", userId),orderBy("timestamp", "desc"),limit(messageLimit));
  const receivedMessagesQuery = query( messagesRef, where("recipientId", "==", userId),orderBy("timestamp", "desc"),limit(messageLimit));
  try {
    const [sentSnapshot, receivedSnapshot] = await Promise.all([getDocs(sentMessagesQuery),getDocs(receivedMessagesQuery)]);
    const allMessagesMap = new Map<string, Message>();
    for (const docSnap of sentSnapshot.docs) {
      const data = docSnap.data() as FirestoreMessage;
      let recipientName = data.recipientName;
      if (data.recipientId && (recipientName === data.recipientId || !recipientName)) {
        const profile = await getUserProfile(data.recipientId);
        recipientName = profile?.name || profile?.displayName || data.recipientId;
      }
      allMessagesMap.set(docSnap.id, mapMessageFromFirestore(data, docSnap.id, data.senderName, recipientName));
    }
    for (const docSnap of receivedSnapshot.docs) {
      const data = docSnap.data() as FirestoreMessage;
      let senderName = data.senderName;
      if (data.senderId && (senderName === data.senderId || !senderName)) {
        const profile = await getUserProfile(data.senderId);
        senderName = profile?.name || profile?.displayName || data.senderId;
      }
      if (!allMessagesMap.has(docSnap.id)) {
         allMessagesMap.set(docSnap.id, mapMessageFromFirestore(data, docSnap.id, senderName, data.recipientName));
      }
    }
    const combinedMessages = Array.from(allMessagesMap.values());
    combinedMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return combinedMessages.slice(0, messageLimit);
  } catch (error) {
    console.error("[getMessagesForUserOrCoach] Error fetching messages:", error);
    throw error; 
  }
};

// Function to get messages specifically between two users
export const getSpecificConversationMessages = async (userId1: string, userId2: string, messageLimit: number = 50): Promise<Message[]> => {
  if (!userId1 || !userId2) {
    console.warn("[getSpecificConversationMessages] Both user IDs must be provided.");
    return [];
  }

  const messagesRef = collection(db, "messages");
  // Query for messages where (sender is userId1 AND recipient is userId2)
  const q1 = query(
    messagesRef,
    where("senderId", "==", userId1),
    where("recipientId", "==", userId2),
    orderBy("timestamp", "desc"), // Get newest first for limit, then reverse on client for display
    limit(messageLimit)
  );
  // Query for messages where (sender is userId2 AND recipient is userId1)
  const q2 = query(
    messagesRef,
    where("senderId", "==", userId2),
    where("recipientId", "==", userId1),
    orderBy("timestamp", "desc"),
    limit(messageLimit)
  );

  try {
    const [snapshot1, snapshot2] = await Promise.all([
      getDocs(q1),
      getDocs(q2)
    ]);

    const conversationMessagesMap = new Map<string, Message>();

    // Process messages from query 1 (userId1 to userId2)
    for (const docSnap of snapshot1.docs) {
      const data = docSnap.data() as FirestoreMessage;
      // Names should be on FirestoreMessage, but enrich if necessary (though less critical here than in a list view)
      conversationMessagesMap.set(docSnap.id, mapMessageFromFirestore(data, docSnap.id, data.senderName, data.recipientName));
    }
    // Process messages from query 2 (userId2 to userId1)
    for (const docSnap of snapshot2.docs) {
      const data = docSnap.data() as FirestoreMessage;
      if (!conversationMessagesMap.has(docSnap.id)) { // Avoid duplicates if a message somehow matched both (shouldn't happen)
         conversationMessagesMap.set(docSnap.id, mapMessageFromFirestore(data, docSnap.id, data.senderName, data.recipientName));
      }
    }
    
    const combinedMessages = Array.from(conversationMessagesMap.values());
    // Sort oldest to newest for chat display
    combinedMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()); 
    
    return combinedMessages.slice(-messageLimit); // Ensure overall limit after merge, taking the most recent ones if total > limit

  } catch (error) {
    console.error("[getSpecificConversationMessages] Error fetching specific conversation messages:", error);
    throw error;
  }
};

// Function to mark messages as read
export const markMessagesAsRead = async (messageIdsToMark: string[], currentUserId: string): Promise<void> => {
  if (!messageIdsToMark || messageIdsToMark.length === 0) {
    return;
  }
  if (!currentUserId) {
    console.warn("[markMessagesAsRead] currentUserId not provided.");
    return;
  }
  console.log(`[markMessagesAsRead] Attempting to mark ${messageIdsToMark.length} messages as read for user ${currentUserId}.`);

  const batch = writeBatch(db);
  let actuallyMarkedCount = 0;

  // Fetch each message to ensure current user is the recipient before marking as read
  // This is a safety check, though the calling logic should also ensure this.
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
    } catch (error) {
      console.error(`[markMessagesAsRead] Error fetching message ${messageId} for verification:`, error);
      // Decide if you want to continue or stop the batch on error
    }
  }

  if (actuallyMarkedCount > 0) {
    try {
      await batch.commit();
      console.log(`[markMessagesAsRead] Successfully marked ${actuallyMarkedCount} messages as read.`);
    } catch (error) {
      console.error("[markMessagesAsRead] Error committing batch to mark messages as read:", error);
      throw error; // Re-throw to allow UI to handle
    }
  } else {
    console.log("[markMessagesAsRead] No messages needed to be marked as read for this user.");
  }
};

