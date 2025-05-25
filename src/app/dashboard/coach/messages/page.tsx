"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { getMessagesForUserOrCoach } from "@/lib/messageService";
// Removed: import { getUsersByIds } from "@/lib/userService"; 
import type { Message, UserProfile } from "@/types";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export default function CoachMessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rawMessages, setRawMessages] = useState<Message[]>([]);
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile | null>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false); // New state for profile loading
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user && user.id) {
      const coachId = user.id;
      setErrorMessage(null);
      const loadMessages = async () => {
        setIsLoading(true);
        try {
          const data = await getMessagesForUserOrCoach(coachId);
          if (Array.isArray(data)) {
            setRawMessages(data);
          } else {
            setRawMessages([]);
            setErrorMessage("Received unexpected data format.");
          }
        } catch (error: any) {
          setRawMessages([]);
          setErrorMessage(`Error loading messages: ${error.message || 'Unknown error'}.`);
        } finally {
          setIsLoading(false);
        }
      };
      loadMessages();
    } else if (!authLoading && !user) {
      setIsLoading(false);
      setRawMessages([]);
      setErrorMessage("Please log in to view your messages.");
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (rawMessages.length > 0 && user && user.id) {
      const fetchProfilesAPI = async () => {
        const otherPartyIds = Array.from(
          new Set(
            rawMessages.map(msg => (msg.senderId === user.id ? msg.recipientId : msg.senderId))
          )
        );

        if (otherPartyIds.length > 0) {
          setIsLoadingProfiles(true);
          console.log("[CoachMessagesPage] Fetching profiles via API for IDs:", otherPartyIds);
          try {
            const response = await fetch('/api/user-profiles', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ userIds: otherPartyIds }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `API request failed with status ${response.status}`);
            }

            const profilesObject: { [key: string]: UserProfile | null } = await response.json();
            const profilesMap = new Map<string, UserProfile | null>();
            Object.entries(profilesObject).forEach(([id, profile]) => {
              profilesMap.set(id, profile);
            });
            setUserProfiles(profilesMap);
            console.log("[CoachMessagesPage] Successfully fetched user profiles via API:", profilesMap);
          } catch (error: any) {
            console.error("[CoachMessagesPage] Failed to fetch user profiles via API:", error);
            setErrorMessage(`Error fetching profiles: ${error.message}`);
            // Set empty map or handle fallback more gracefully if needed
            setUserProfiles(new Map()); 
          } finally {
            setIsLoadingProfiles(false);
          }
        }
      };
      fetchProfilesAPI();
    }
  }, [rawMessages, user]);

  const displayedConversations = useMemo(() => {
    if (!user || !user.id || rawMessages.length === 0) return [];

    const conversationsMap = new Map<string, DisplayedConversation>();
    const sortedMessages = [...rawMessages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    sortedMessages.forEach(msg => {
      const currentUserId = user.id!;
      const otherPartyId = msg.senderId === currentUserId ? msg.recipientId : msg.senderId;
      
      const profile = userProfiles.get(otherPartyId);
      const otherPartyName = profile?.name || otherPartyId;

      const ids = [currentUserId, otherPartyId].sort();
      const conversationId = ids.join('_');

      let currentUnreadCount = 0;
      if (msg.recipientId === currentUserId && !msg.read) {
        currentUnreadCount = 1;
      }

      const existingConversation = conversationsMap.get(conversationId);
      if (existingConversation) {
        existingConversation.lastMessageContent = msg.content;
        existingConversation.lastMessageTimestamp = msg.timestamp;
        existingConversation.otherPartyName = otherPartyName; 
        existingConversation.otherPartyAvatar = profile?.avatarUrl || undefined;
        if (msg.recipientId === currentUserId && !msg.read) {
          existingConversation.unreadCount += 1;
        }
      } else {
        conversationsMap.set(conversationId, {
          conversationId,
          otherPartyId,
          otherPartyName,
          otherPartyAvatar: profile?.avatarUrl || undefined,
          lastMessageContent: msg.content,
          lastMessageTimestamp: msg.timestamp,
          unreadCount: currentUnreadCount,
        });
      }
    });
    return Array.from(conversationsMap.values()).sort((a,b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());
  }, [rawMessages, user, userProfiles]);

  if (authLoading || (isLoading && user) || isLoadingProfiles) { // Added isLoadingProfiles
    return <div className="container mx-auto p-4 text-center"><p>Loading conversations...</p></div>;
  }
  if (errorMessage && !displayedConversations.length) { // Only show full page error if no convos to show
    return <div className="container mx-auto p-4 text-center text-red-600"><p>{errorMessage}</p></div>;
  }
  if (!user) {
    return <div className="container mx-auto p-4 text-center"><p>Please log in.</p></div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Message Center</h1>
      </div>
      {errorMessage && displayedConversations.length > 0 && (
        <p className="text-red-600 text-center mb-4">{errorMessage}</p> // Inline error if convos are present
      )}
      {displayedConversations.length === 0 && !isLoading && !isLoadingProfiles ? (
        <div className="text-center py-10">
          <MessageSquarePlus className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No conversations</h3>
          <p className="mt-1 text-sm text-gray-500">
            {errorMessage ? errorMessage : "You currently have no active conversations."}
          </p>
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
                        {conv.otherPartyAvatar ? <AvatarImage src={conv.otherPartyAvatar} alt={conv.otherPartyName} /> : null}
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
