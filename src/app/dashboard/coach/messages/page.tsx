
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2, AlertCircle, Info, RefreshCw } from "lucide-react";
import type { Message as MessageType } from "@/types";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import { useEffect, useState, useCallback } from "react";
import { getMessagesForUser, getUserProfile, getCoachById } from "@/lib/firestore";
import Link from "next/link";

export default function CoachMessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<MessageType[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (user && user.id && user.role === 'coach') {
      setIsLoadingMessages(true);
      setError(null);
      console.log(`[CoachMessagesPage] Attempting to fetch messages for coach UID: ${user.id}`);
      try {
        const fetchedMessages = await getMessagesForUser(user.id);
        console.log(`[CoachMessagesPage] Fetched ${fetchedMessages.length} raw messages for coach ${user.id}`);
        
        const convosMap = new Map<string, MessageType>();
        for (const msg of fetchedMessages) {
          const otherPartyId = msg.senderId === user.id ? msg.recipientId : msg.senderId;
          let otherPartyName = msg.senderId === user.id ? msg.recipientName : msg.senderName;
          let otherPartyAvatar = null; // Keep track of fetched avatar

          // Prioritize fetching other party's display name and avatar if not already on message
          if (!otherPartyName || !msg.otherPartyAvatar) {
            const userProfile = await getUserProfile(otherPartyId); // Assuming clients are 'user' role primarily
            if (userProfile) {
              otherPartyName = userProfile.name || otherPartyName || 'Unknown User';
              otherPartyAvatar = userProfile.profileImageUrl || msg.otherPartyAvatar || undefined;
            } else {
              // Fallback if getUserProfile returns null (e.g. no profile or other role)
              otherPartyName = otherPartyName || 'Unknown User';
              otherPartyAvatar = msg.otherPartyAvatar || undefined;
            }
          } else {
            otherPartyAvatar = msg.otherPartyAvatar || undefined;
          }


          if (!convosMap.has(otherPartyId) || new Date(msg.timestamp) > new Date(convosMap.get(otherPartyId)!.timestamp)) {
            convosMap.set(otherPartyId, {
              ...msg,
              otherPartyName: otherPartyName,
              otherPartyAvatar: otherPartyAvatar,
              dataAiHint: "person avatar"
            });
          }
        }
        const sortedConversations = Array.from(convosMap.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setConversations(sortedConversations);
        console.log(`[CoachMessagesPage] Processed into ${sortedConversations.length} conversations for coach ${user.id}`);

      } catch (err: any) {
        console.error("[CoachMessagesPage] Error fetching coach messages:", err.code, err.message, err);
        setError(`Failed to load messages. ${err.message || 'Please try again.'}`);
      } finally {
        setIsLoadingMessages(false);
      }
    } else if (!authLoading && (!user || user.role !== 'coach')) {
      setIsLoadingMessages(false);
      setError("Please log in as a coach to view your messages.");
      console.warn("[CoachMessagesPage] User not authenticated or not a coach.");
    }
  }, [user, authLoading]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  if (authLoading || isLoadingMessages) {
    return (
      <div className="flex flex-col justify-center items-center h-full min-h-[300px] space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span>Loading messages...</span>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl flex items-center">
            <MessageSquare className="mr-3 h-8 w-8 text-primary" />
            Client Messages
          </CardTitle>
          <CardDescription>View and respond to messages from potential and current clients. Click to view full thread (feature coming soon).</CardDescription>
        </CardHeader>
      </Card>

      {error && (
         <Card className="text-center py-12 bg-destructive/10 border-destructive">
          <CardHeader>
            <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
            <CardTitle className="text-destructive">Error Loading Messages</CardTitle>
            <CardDescription className="text-destructive/80">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchMessages} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4"/> Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && conversations.length > 0 ? (
        <div className="space-y-4">
          {conversations.map((message) => (
            <Card 
                key={message.id} 
                className={`hover:shadow-md transition-shadow ${!message.read && message.senderId !== user?.id ? 'border-primary ring-2 ring-primary' : 'border-border'}`}
            >
              <CardContent className="p-4 flex items-start space-x-4">
                 {(message.otherPartyAvatar) ? (
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={message.otherPartyAvatar} alt={message.otherPartyName || 'User'} data-ai-hint={message.dataAiHint as string || 'person avatar'} />
                    <AvatarFallback>{message.otherPartyName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                ) : (
                     <Avatar className="h-10 w-10 border bg-muted">
                        <AvatarFallback className="text-muted-foreground">{message.otherPartyName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                )}
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">{message.otherPartyName || (message.senderId === user?.id ? "To Client" : "From Client")}</h3>
                    <span className="text-xs text-muted-foreground">{format(new Date(message.timestamp), 'PP p')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                     {message.senderId === user?.id ? <span className="font-medium text-foreground/80">You: </span> : ''}{message.content}
                  </p>
                </div>
                <div className="flex flex-col items-end space-y-1">
                    {!message.read && message.senderId !== user?.id && <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">New</Badge>}
                    <Button variant="outline" size="sm" disabled>View Thread</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
         !error && (
            <Card className="text-center py-16">
                <CardHeader>
                    <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <CardTitle>No Messages Yet</CardTitle>
                    <CardDescription>Your client messages will appear here once you start receiving inquiries.</CardDescription>
                </CardHeader>
                 <CardContent>
                    <Button onClick={fetchMessages} variant="outline">
                        <RefreshCw className="mr-2 h-4 w-4"/> Check for Messages
                    </Button>
                </CardContent>
            </Card>
         )
      )}
    </div>
  );
}

    