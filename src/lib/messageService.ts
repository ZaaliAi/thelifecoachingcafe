// "use client"; // <-- REMOVED THIS LINE

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
  writeBatch
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
  const data = docData as Omit<FirestoreMessage, 'id' | 'timestamp'> & { timestamp: Timestamp; conversationId?: string }; 
  return {
    id,
    senderId: data.senderId,
    recipientId: data.recipientId,
    content: data.content,
    timestamp: data.timestamp.toDate().toISOString(),
    read: data.read || false,
    senderName: defaultSenderName || data.senderName || "Unknown User", // MODIFIED FALLBACK
    recipientName: defaultRecipientName || data.recipientName || "Unknown User", // MODIFIED FALLBACK
    conversationId: data.conversationId || "",
  };
};

export const sendMessageToFirestore = async (
  senderId: string,
  recipientId: string,
  content: string,
  senderName: string, 
  recipientName: string
): Promise<string> => {
  console.log("sendMessageToFirestore called!");
  console.log("Arguments:", { senderId, recipientId, content, senderName, recipientName });
  try {
    const conversationId = await getOrCreateConversation(senderId, recipientId);

    const messagesColRef = collection(db, "messages"); 
    const messageDoc: Omit<FirestoreMessage, 'id'> & { conversationId: string } = {
      senderId,
      recipientId,
      content,
      timestamp: serverTimestamp() as Timestamp,
      senderName,
      recipientName,
      read: false,
      conversationId,
    };

    console.log("Message doc:", messageDoc);
    const messageDocRef = await addDoc(messagesColRef, messageDoc);
    const conversationDocRef = doc(db, "conversations", conversationId);
    await updateDoc(conversationDocRef, {
      lastMessage: content,
      lastMessageSenderId: senderId,
      updatedAt: serverTimestamp(),
    });
    return messageDocRef.id;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

export const fetchConversationMessages = async (
  conversationId: string,
  userId: string
): Promise<Message[]> => {
  if (!conversationId || !userId) {
    console.warn("[fetchConversationMessages] No conversationId or userId provided.");
    return [];
  }
  const messagesRef = collection(db, "messages");

  const sentQuery = query(
    messagesRef,
    where("conversationId", "==", conversationId),
    where("senderId", "==", userId),
    orderBy("timestamp", "asc")
  );

  const receivedQuery = query(
    messagesRef,
    where("conversationId", "==", conversationId),
    where("recipientId", "==", userId),
    orderBy("timestamp", "asc")
  );

  const [sentSnap, receivedSnap] = await Promise.all([
    getDocs(sentQuery),
    getDocs(receivedQuery)
  ]);

  const allMessagesMap = new Map<string, Message>();
  const processSnap = async (snap: any) => {
    for (const doc of snap.docs) {
      const data = doc.data();
      let senderNameToUse = data.senderName;
      let recipientNameToUse = data.recipientName;

      if (data.senderId && (senderNameToUse === data.senderId || !senderNameToUse)) {
          const profile = await getUserProfile(data.senderId);
          senderNameToUse = profile?.name || profile?.displayName || "Unknown User"; // MODIFIED FALLBACK
      }
      if (data.recipientId && (recipientNameToUse === data.recipientId || !recipientNameToUse)) {
          const profile = await getUserProfile(data.recipientId);
          recipientNameToUse = profile?.name || profile?.displayName || "Unknown User"; // MODIFIED FALLBACK
      }
      allMessagesMap.set(doc.id, mapMessageFromFirestore(data, doc.id, senderNameToUse, recipientNameToUse));
    }
  };
  await Promise.all([processSnap(sentSnap), processSnap(receivedSnap)]);

  return Array.from(allMessagesMap.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
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
        memberNames: [user1Profile?.name || user1Profile?.displayName || "Unknown User", user2Profile?.name || user2Profile?.displayName || "Unknown User"], // MODIFIED FALLBACK
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
      const memberNames = (data.memberNames || []).map((name: string, index: number) => 
        name || (data.members && data.members[index] ? "Unknown User" : "Unknown User") // MODIFIED FALLBACK
      );
      return {
        id: docSnap.id,
        members: data.members,
        memberNames: memberNames,
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
    const data = doc.data(); 
    let senderName = data.senderName;
    if (data.senderId && (senderName === data.senderId || !senderName)) {
      const profile = await getUserProfile(data.senderId);
      senderName = profile?.name || profile?.displayName || "Unknown User"; // MODIFIED FALLBACK
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
  const receivedMessagesQuery = query(messagesRef, where("recipientId", "==", userId),orderBy("timestamp", "desc"),limit(messageLimit));
  try {
    const [sentSnapshot, receivedSnapshot] = await Promise.all([getDocs(sentMessagesQuery),getDocs(receivedMessagesQuery)]);
    const allMessagesMap = new Map<string, Message>();
    for (const docSnap of sentSnapshot.docs) {
      const data = docSnap.data();
      let recipientName = data.recipientName;
      if (data.recipientId && (recipientName === data.recipientId || !recipientName)) {
        const profile = await getUserProfile(data.recipientId);
        recipientName = profile?.name || profile?.displayName || "Unknown User"; // MODIFIED FALLBACK
      }
      allMessagesMap.set(docSnap.id, mapMessageFromFirestore(data, docSnap.id, data.senderName, recipientName));
    }
    for (const docSnap of receivedSnapshot.docs) {
      const data = docSnap.data();
      let senderName = data.senderName;
      if (data.senderId && (senderName === data.senderId || !senderName)) {
        const profile = await getUserProfile(data.senderId);
        senderName = profile?.name || profile?.displayName || "Unknown User"; // MODIFIED FALLBACK
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

export const getSpecificConversationMessages = async (userId1: string, userId2: string, messageLimit: number = 50): Promise<Message[]> => {
  if (!userId1 || !userId2) {
    console.warn("[getSpecificConversationMessages] Both user IDs must be provided.");
    return [];
  }
  const conversationId = [userId1, userId2].sort().join('_');
  return fetchConversationMessages(conversationId, userId1); // Relies on fetchConversationMessages updates
};

export const markMessagesAsRead = async (messageIdsToMark: string[], currentUserId: string): Promise<void> => {
  if (!messageIdsToMark || messageIdsToMark.length === 0) {
    return;
  }
  if (!currentUserId) {
    console.warn("[markMessagesAsRead] currentUserId not provided.");
    return;
  }
  const batch = writeBatch(db);
  let actuallyMarkedCount = 0;

  for (const messageId of messageIdsToMark) {
    const messageRef = doc(db, "messages", messageId);
    try {
      const messageSnap = await getDoc(messageRef);
      if (messageSnap.exists()) {
        const messageData = messageSnap.data() as FirestoreMessage;
        if (messageData.recipientId === currentUserId && !(messageData as any).read) {
          batch.update(messageRef, { read: true });
          actuallyMarkedCount++;
        }
      }
    } catch (error) {
      console.error(`[markMessagesAsRead] Error fetching message ${messageId} for verification:`, error);
    }
  }

  if (actuallyMarkedCount > 0) {
    try {
      await batch.commit();
    } catch (error) {
      console.error("[markMessagesAsRead] Error committing batch to mark messages as read:", error);
      throw error; 
    }
  }
};
