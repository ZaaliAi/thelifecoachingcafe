"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { getMessagesForUserOrCoach } from "@/lib/messageService";
import type { Message } from "@/types";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChevronRight, MessageSquarePlus } from "lucide-react";

interface DisplayedConversation {
  conversationId: string; 
  otherPartyId: string;
  otherPartyName: string;
  otherPartyAvatar?: string | null;
  lastMessageContent: string;
  lastMessageTimestamp: string;
  unreadCount: number;
}

export default function UserMessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rawMessages, setRawMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    console.log("[UserMessagesPage] Auth loading:", authLoading, "User object:", user);
    if (!authLoading && user && user.id) {
      const currentUserId = user.id;
      console.log(`[UserMessagesPage] Authenticated. Attempting to load messages for user UID: ${currentUserId}`);
      setErrorMessage(null);
      const loadMessages = async () => {
        setIsLoading(true);
        try {
          // Use getMessagesForUserOrCoach which fetches both sent and received messages
          const data = await getMessagesForUserOrCoach(currentUserId);
          console.log("[UserMessagesPage] Successfully fetched raw message data:", data);
          if (Array.isArray(data)) {
            setRawMessages(data);
          } else {
            console.error("[UserMessagesPage] getMessagesForUserOrCoach did not return an array:", data);
            setRawMessages([]);
            setErrorMessage("Received unexpected data format.");
          }
        } catch (error: any) {
          console.error("[UserMessagesPage] CRITICAL: Failed to load messages for user.", error);
          setRawMessages([]);
          setErrorMessage(`Error loading messages: ${error.message || 'Unknown error'}.`);
        } finally {
          setIsLoading(false);
        }
      };
      loadMessages();
    } else if (!authLoading && !user) {
      console.warn("[UserMessagesPage] Not authenticated. Cannot load messages.");
      setIsLoading(false);
      setRawMessages([]);
      setErrorMessage("Please log in to view your messages.");
    }
  }, [user, authLoading]);

  const displayedConversations = useMemo(() => {
    if (!user || !user.id || rawMessages.length === 0) {
      console.log("[UserMessagesPage] rawMessages is empty or user is not available. Returning empty conversations array.");
      return [];
    }

    const conversationsMap = new Map<string, DisplayedConversation>();
    const currentUserId = user.id;

    // Sort messages by timestamp to correctly identify the last message
    const sortedMessages = [...rawMessages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    sortedMessages.forEach(msg => {
      // Determine the other party in the conversation
      const otherPartyId = msg.senderId === currentUserId ? msg.recipientId : msg.senderId;
      const otherPartyName = msg.senderId === currentUserId 
        ? (msg.recipientName || otherPartyId) 
        : (msg.senderName || otherPartyId);
      
      // Construct a consistent conversation ID by sorting UIDs
      const ids = [currentUserId, otherPartyId].sort();
      const conversationId = ids.join('_');

      // Initialize unread count for this message if it's for the current user and unread
      let messageUnreadCount = 0;
      if (msg.recipientId === currentUserId && !msg.read) {
        messageUnreadCount = 1;
      }

      const existingConversation = conversationsMap.get(conversationId);
      if (existingConversation) {
        // Update with the latest message details
        existingConversation.lastMessageContent = msg.content;
        existingConversation.lastMessageTimestamp = msg.timestamp;
        // Add to unread count if the *latest* message is unread for the current user
        // NOTE: This logic is slightly different from summing all unread messages. 
        // To sum all unread, we'd accumulate here. Let's stick to the coach logic
        // which seems to just count unread messages directed to the user in the raw list.
        // Let's recalculate total unread messages for this conversation in the final pass.

        // Temporarily just update latest message info
        conversationsMap.set(conversationId, { // Re-set to ensure latest message props are captured
           ...existingConversation, // Keep accumulated unread count from previous messages
           lastMessageContent: msg.content,
           lastMessageTimestamp: msg.timestamp,
           // Don't update unreadCount here; calculate it in the final pass.
        });

      } else {
        // Create a new conversation entry
        conversationsMap.set(conversationId, {
          conversationId,
          otherPartyId,
          otherPartyName,
          // TODO: Fetch otherPartyAvatar if available from user profiles (similar to coach page)
          otherPartyAvatar: null, // Placeholder
          lastMessageContent: msg.content,
          lastMessageTimestamp: msg.timestamp,
          unreadCount: messageUnreadCount, // Initialize with 1 if the first message encountered is unread
        });
      }
    });

    // --- Second pass to calculate total unread count per conversation ---
    // This is necessary because a conversation might have multiple unread messages
    // not just the last one.
    const conversationsWithUnreadCount = new Map<string, DisplayedConversation>();

    // Re-process sortedMessages to accurately sum unread messages for the current user in each conversation
    sortedMessages.forEach(msg => {
       const otherPartyId = msg.senderId === currentUserId ? msg.recipientId : msg.senderId;
       const ids = [currentUserId, otherPartyId].sort();
       const conversationId = ids.join('_');

       const existingConv = conversationsWithUnreadCount.get(conversationId) || conversationsMap.get(conversationId);

       if (existingConv) {
          let currentUnreadCount = existingConv.unreadCount || 0; // Use accumulated count
          if (msg.recipientId === currentUserId && !msg.read) {
             currentUnreadCount += 1;
          }
           conversationsWithUnreadCount.set(conversationId, {
             ...existingConv,
             unreadCount: currentUnreadCount,
             // Keep the latest message info from the first pass
           });
       } else { // Should not happen if conversationsMap was built correctly in first pass
         console.warn(`[UserMessagesPage] Conversation ${conversationId} not found in first pass map.`);
       }
    });

    console.log("[UserMessagesPage] Calculated conversations with unread counts:", Array.from(conversationsWithUnreadCount.values()));

    // Sort conversations by the timestamp of their last message (most recent first)
    return Array.from(conversationsWithUnreadCount.values()).sort((a,b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());
  }, [rawMessages, user]);

  if (authLoading || (isLoading && user)) {
    return <div className="container mx-auto p-4 text-center"><p>Loading messages...</p></div>;
  }
  if (errorMessage) {
    return <div className="container mx-auto p-4 text-center text-red-600"><p>{errorMessage}</p></div>;
  }
  if (!user) {
    return <div className="container mx-auto p-4 text-center"><p>Please log in.</p></div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Your Inbox</h1>
        {/* Optional: Button to start a new message if applicable for users */}
        {/* 
        <Button variant="outline" onClick={() => router.push('/messages/new')}> 
          <MessageSquarePlus className="mr-2 h-4 w-4" /> New Message
        </Button>
        */}
      </div>

      {displayedConversations.length === 0 && !isLoading ? (
        <div className="text-center py-10">
          <MessageSquarePlus className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No conversations</h3>
          <p className="mt-1 text-sm text-gray-500">You currently have no active conversations.</p>
        </div>
      ) : (
        <div className="border rounded-md">
          <ul className="divide-y divide-gray-200">
            {displayedConversations.map((conv) => (
              <li key={conv.conversationId} className="hover:bg-gray-50 transition-colors">
                <Link href={`/dashboard/messages/${conv.conversationId}`} className="block p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0">
                      {/* Avatar placeholder */}
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12 mr-3 sm:mr-4">
                         <AvatarFallback>{conv.otherPartyName.substring(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm sm:text-base font-semibold text-primary truncate">{conv.otherPartyName}</p>
                        <p className="text-xs sm:text-sm text-gray-500 truncate">{conv.lastMessageContent}</p>
                      </div>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <p className="text-xs text-gray-400 mb-1">{new Date(conv.lastMessageTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric'})}</p>
                      {/* Display unread count */}
                      {conv.unreadCount > 0 && 
                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                          {conv.unreadCount}
                        </span>
                      }
                      <ChevronRight className="h-5 w-5 text-gray-400 hidden sm:inline-block ml-auto mt-1" />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
