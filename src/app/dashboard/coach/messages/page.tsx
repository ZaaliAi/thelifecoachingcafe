"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation'; // Corrected import for App Router
import { getMessagesForUserOrCoach } from "@/lib/messageService";
import type { Message } from "@/types";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Assuming you have an Avatar component
import { Button } from "@/components/ui/button";
import { ChevronRight, MessageSquarePlus } from "lucide-react"; // Icons

interface DisplayedConversation {
  conversationId: string; 
  otherPartyId: string;
  otherPartyName: string;
  otherPartyAvatar?: string | null; // Optional: if you can fetch this
  lastMessageContent: string;
  lastMessageTimestamp: string;
  unreadCount: number;
}

export default function CoachMessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rawMessages, setRawMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    console.log("[CoachMessagesPage] Auth loading:", authLoading, "User object:", user);
    if (!authLoading && user && user.id) {
      const coachId = user.id;
      console.log(`[CoachMessagesPage] Authenticated. Attempting to load messages for coach UID: ${coachId}`);
      setErrorMessage(null);
      const loadMessages = async () => {
        setIsLoading(true);
        try {
          const data = await getMessagesForUserOrCoach(coachId);
          console.log("[CoachMessagesPage] Successfully fetched data:", data);
          if (Array.isArray(data)) {
            setRawMessages(data);
          } else {
            console.error("[CoachMessagesPage] getMessagesForUserOrCoach did not return an array:", data);
            setRawMessages([]);
            setErrorMessage("Received unexpected data format.");
          }
        } catch (error: any) {
          console.error("[CoachMessagesPage] CRITICAL: Failed to load messages for coach.", error);
          setRawMessages([]);
          setErrorMessage(`Error loading messages: ${error.message || 'Unknown error'}.`);
        } finally {
          setIsLoading(false);
        }
      };
      loadMessages();
    } else if (!authLoading && !user) {
      console.warn("[CoachMessagesPage] Not authenticated. Cannot load messages.");
      setIsLoading(false);
      setRawMessages([]);
      setErrorMessage("Please log in to view your messages.");
    }
  }, [user, authLoading]);

  const displayedConversations = useMemo(() => {
    if (!user || !user.id || rawMessages.length === 0) return [];

    const conversationsMap = new Map<string, DisplayedConversation>();

    // Sort messages by timestamp to correctly identify the last message
    const sortedMessages = [...rawMessages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    sortedMessages.forEach(msg => {
      const otherPartyId = msg.senderId === user.id ? msg.recipientId : msg.senderId;
      const otherPartyName = msg.senderId === user.id 
        ? (msg.recipientName || otherPartyId) 
        : (msg.senderName || otherPartyId);
      
      // Construct a consistent conversation ID by sorting UIDs
      const ids = [user.id, otherPartyId].sort();
      const conversationId = ids.join('_');

      let currentUnreadCount = 0;
      if (msg.recipientId === user.id && !msg.read) {
        currentUnreadCount = 1;
      }

      const existingConversation = conversationsMap.get(conversationId);
      if (existingConversation) {
        existingConversation.lastMessageContent = msg.content;
        existingConversation.lastMessageTimestamp = msg.timestamp;
        if (msg.recipientId === user.id && !msg.read) {
          existingConversation.unreadCount += 1;
        }
      } else {
        conversationsMap.set(conversationId, {
          conversationId,
          otherPartyId,
          otherPartyName,
          // TODO: Fetch otherPartyAvatar if available from user profiles
          lastMessageContent: msg.content,
          lastMessageTimestamp: msg.timestamp,
          unreadCount: currentUnreadCount,
        });
      }
    });
    // Sort conversations by the timestamp of their last message (most recent first)
    return Array.from(conversationsMap.values()).sort((a,b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());
  }, [rawMessages, user]);

  if (authLoading || (isLoading && user)) {
    return <div className="container mx-auto p-4 text-center"><p>Loading conversations...</p></div>;
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
        <h1 className="text-2xl font-bold">Message Center</h1>
        {/* Optional: Button to start a new message if applicable for coaches */}
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
                      <Avatar className="h-10 w-10 sm:h-12 sm:w-12 mr-3 sm:mr-4">
                        {/* Placeholder for avatar - you'd fetch this if available */}
                        <AvatarFallback>{conv.otherPartyName.substring(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm sm:text-base font-semibold text-primary truncate">{conv.otherPartyName}</p>
                        <p className="text-xs sm:text-sm text-gray-500 truncate">{conv.lastMessageContent}</p>
                      </div>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <p className="text-xs text-gray-400 mb-1">{new Date(conv.lastMessageTimestamp).toLocaleDateString([], { month: 'short', day: 'numeric'})}</p>
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
