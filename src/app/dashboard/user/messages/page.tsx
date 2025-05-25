"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { getMessagesForUserOrCoach } from "@/lib/messageService";
import type { Message, UserProfile } from "@/types";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ChevronRight, MessageSquarePlus } from "lucide-react";
// DO NOT import getUsersByIds from "@/lib/userService" here anymore

interface DisplayedConversation {
  conversationId: string;
  otherPartyId: string;
  otherPartyName: string;
  otherPartyAvatar?: string | null;
  lastMessageContent: string;
  lastMessageTimestamp: string;
  unreadCount: number;
}

async function fetchUserProfilesFromApi(userIds: string[]): Promise<Map<string, UserProfile | null>> {
  if (userIds.length === 0) {
    return new Map();
  }
  try {
    const response = await fetch('/api/users/profiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userIds }),
    });
    if (!response.ok) {
      console.error("Failed to fetch user profiles from API", response.status, await response.text());
      // Return a map where requested IDs map to null to indicate failure for these IDs
      const errorMap = new Map<string, UserProfile | null>();
      userIds.forEach(id => errorMap.set(id, null));
      return errorMap;
    }
    const profilesObject = await response.json();
    // Convert the plain object back to a Map
    const profilesMap = new Map<string, UserProfile | null>();
    for (const [id, profile] of Object.entries(profilesObject)) {
        profilesMap.set(id, profile as UserProfile | null);
    }
    return profilesMap;
  } catch (error) {
    console.error("Error calling /api/users/profiles:", error);
    const errorMap = new Map<string, UserProfile | null>();
    userIds.forEach(id => errorMap.set(id, null));
    return errorMap;
  }
}

export default function UserMessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [rawMessages, setRawMessages] = useState<Message[]>([]);
  const [userProfilesMap, setUserProfilesMap] = useState<Map<string, UserProfile | null>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user && user.id) {
      const currentUserId = user.id;
      setErrorMessage(null);
      const loadData = async () => {
        setIsLoading(true);
        try {
          const messagesData = await getMessagesForUserOrCoach(currentUserId);
          if (Array.isArray(messagesData)) {
            setRawMessages(messagesData);
            if (messagesData.length > 0) {
              const otherPartyIds = Array.from(
                new Set(
                  messagesData.map(msg => 
                    msg.senderId === currentUserId ? msg.recipientId : msg.senderId
                  ).filter(id => id) // ensure no undefined/null ids
                )
              );
              if (otherPartyIds.length > 0) {
                console.log("[UserMessagesPage] Fetching profiles for otherPartyIds via API:", otherPartyIds);
                const profiles = await fetchUserProfilesFromApi(otherPartyIds);
                setUserProfilesMap(profiles);
                console.log("[UserMessagesPage] User profiles map updated from API:", profiles);
              }
            }
          } else {
            console.error("[UserMessagesPage] getMessagesForUserOrCoach did not return an array:", messagesData);
            setRawMessages([]);
            setErrorMessage("Received unexpected data format for messages.");
          }
        } catch (error: any) {
          console.error("[UserMessagesPage] CRITICAL: Failed to load messages or profiles.", error);
          setRawMessages([]);
          setUserProfilesMap(new Map());
          setErrorMessage(`Error loading data: ${error.message || 'Unknown error'}.`);
        } finally {
          setIsLoading(false);
        }
      };
      loadData();
    } else if (!authLoading && !user) {
      setIsLoading(false);
      setRawMessages([]);
      setErrorMessage("Please log in to view your messages.");
    }
  }, [user, authLoading]);

  const displayedConversations = useMemo(() => {
    if (!user || !user.id || rawMessages.length === 0) {
      return [];
    }
    const conversationsMap = new Map<string, DisplayedConversation>();
    const currentUserId = user.id;
    const sortedMessages = [...rawMessages].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    sortedMessages.forEach(msg => {
      const otherPartyId = msg.senderId === currentUserId ? msg.recipientId : msg.senderId;
      if (!otherPartyId) {
        console.warn(`Message ID ${msg.id || 'N/A'} has invalid otherPartyId. Skipping.`);
        return; // Skip this message if otherPartyId is undefined or null
      }
      
      const profile = userProfilesMap.get(otherPartyId);
      let determinedOtherPartyName = profile?.name;

      if (!determinedOtherPartyName) {
        determinedOtherPartyName = msg.senderId === currentUserId 
          ? msg.recipientName 
          : msg.senderName;
      }

      const knownPlaceholders = ["Unknown Recipient", "Anonymous", "Unrecognised User", "Unknown User", otherPartyId];
      if (!determinedOtherPartyName || determinedOtherPartyName.trim() === "" || knownPlaceholders.includes(determinedOtherPartyName)) {
        determinedOtherPartyName = "Unknown User";
      }
      
      const ids = [currentUserId, otherPartyId].sort();
      const conversationId = ids.join('_');

      conversationsMap.set(conversationId, {
        conversationId,
        otherPartyId,
        otherPartyName: determinedOtherPartyName,
        otherPartyAvatar: profile?.avatarUrl || null,
        lastMessageContent: msg.content,
        lastMessageTimestamp: msg.timestamp,
        unreadCount: 0,
      });
    });

    conversationsMap.forEach((conv) => {
      let count = 0;
      rawMessages.forEach(msg => {
        const msgOtherPartyId = msg.senderId === currentUserId ? msg.recipientId : msg.senderId;
        if (msgOtherPartyId === conv.otherPartyId && msg.recipientId === currentUserId && !msg.read) {
          count++;
        }
      });
      conv.unreadCount = count;
    });
    
    const finalConversations = Array.from(conversationsMap.values()).sort((a,b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());
    return finalConversations;

  }, [rawMessages, user, userProfilesMap]);

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
        <h1 className="text-2xl font-bold">Message Centre</h1>
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
