
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Search, Loader2, AlertCircle, Info, RefreshCw } from "lucide-react";
import type { Message as MessageType } from "@/types";
import { format } from "date-fns";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useEffect, useState, useCallback } from "react";
import { getMessagesForUser, getCoachById, getUserProfile } from "@/lib/firestore";
import { useRouter } from "next/navigation";


export default function UserMessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<MessageType[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMessages = useCallback(async () => {
    if (user && user.id) {
      setIsLoadingMessages(true);
      setError(null);
      console.log(`[UserMessagesPage] Attempting to fetch messages for user UID: ${user.id}`);
      try {
        const fetchedMessages = await getMessagesForUser(user.id);
        console.log(`[UserMessagesPage] Fetched ${fetchedMessages.length} raw messages for user ${user.id}`);
        
        // Group messages by other party and get the latest message for each conversation
        const convosMap = new Map<string, MessageType>();
        for (const msg of fetchedMessages) {
          // Ensure otherPartyId is populated by getMessagesForUser
          const otherPartyId = msg.otherPartyId; 
          if (!otherPartyId) {
            console.warn("[UserMessagesPage] Message missing otherPartyId:", msg.id);
            continue; 
          }

          // Enrich with profile data if not already present on the message from getMessagesForUser
          let enrichedMsg = { ...msg };
          if (!msg.otherPartyName || !msg.otherPartyAvatar) {
            const coachProfile = await getCoachById(otherPartyId);
            if (coachProfile) {
              enrichedMsg.otherPartyName = coachProfile.name || msg.otherPartyName || 'Unknown Coach';
              enrichedMsg.otherPartyAvatar = coachProfile.profileImageUrl || msg.otherPartyAvatar;
              enrichedMsg.dataAiHint = coachProfile.dataAiHint || "person avatar";
            } else {
              const userProfile = await getUserProfile(otherPartyId);
              if (userProfile) {
                  enrichedMsg.otherPartyName = userProfile.name || msg.otherPartyName || 'Unknown User';
                  enrichedMsg.otherPartyAvatar = userProfile.profileImageUrl || msg.otherPartyAvatar;
                  enrichedMsg.dataAiHint = userProfile.dataAiHint || "person avatar";
              } else {
                  enrichedMsg.otherPartyName = msg.otherPartyName || 'Unknown Contact';
              }
            }
          }
          
          if (!convosMap.has(otherPartyId) || new Date(enrichedMsg.timestamp) > new Date(convosMap.get(otherPartyId)!.timestamp)) {
            convosMap.set(otherPartyId, enrichedMsg);
          }
        }
        const sortedConversations = Array.from(convosMap.values()).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setConversations(sortedConversations);
        console.log(`[UserMessagesPage] Processed into ${sortedConversations.length} conversations for user ${user.id}`);

      } catch (err: any) {
        console.error("[UserMessagesPage] Error fetching user messages:", err.code, err.message, err);
        setError(`Failed to load your messages. ${err.message || 'Please try again.'}`);
      } finally {
        setIsLoadingMessages(false);
      }
    } else if (!authLoading && !user) {
      setIsLoadingMessages(false);
      setError("Please log in to view your messages.");
      console.warn("[UserMessagesPage] User not authenticated.");
    }
  }, [user, authLoading]);
  
  useEffect(() => {
    if (user && user.id) {
        console.log(`[UserMessagesPage] User context available. User ID: ${user.id}. Triggering fetchMessages.`);
        fetchMessages();
    } else if (!authLoading && !user) {
        console.log("[UserMessagesPage] No user in context after auth loading complete.");
         setError("Please log in to view your messages.");
         setIsLoadingMessages(false);
    } else if (authLoading) {
        console.log("[UserMessagesPage] Auth is loading, waiting to fetch messages.");
    }
  }, [user, authLoading, fetchMessages]);


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
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
                <CardTitle className="text-3xl flex items-center">
                    <MessageSquare className="mr-3 h-8 w-8 text-primary" />
                    My Messages
                </CardTitle>
                <CardDescription>Your conversations with coaches. Click to view full thread.</CardDescription>
            </div>
            <Button asChild className="mt-4 sm:mt-0 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/browse-coaches"><Search className="mr-2 h-4 w-4"/>Find a Coach to Message</Link>
            </Button>
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
          {conversations.map((message) => {
            const otherPartyId = message.otherPartyId;
            if (!otherPartyId) return null; // Should not happen if getMessagesForUser populates it

            return (
              <Card 
                  key={message.id} 
                  className={`hover:shadow-md transition-shadow ${!message.read && message.senderId !== user?.id ? 'border-primary ring-2 ring-primary' : 'border-border'}`}
              >
                <CardContent className="p-4 flex items-start space-x-4">
                  {message.otherPartyAvatar ? (
                    <Avatar className="h-10 w-10 border">
                      <AvatarImage src={message.otherPartyAvatar} alt={message.otherPartyName || 'User'} data-ai-hint={message.dataAiHint as string || 'person avatar'} />
                      <AvatarFallback>{message.otherPartyName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                  ) : (
                      <Avatar className="h-10 w-10 border bg-muted">
                          <AvatarFallback>{message.otherPartyName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                  )}
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">{message.otherPartyName || (message.senderId === user?.id ? "To: " + message.recipientName : "From: " + message.senderName)}</h3>
                      <span className="text-xs text-muted-foreground">{format(new Date(message.timestamp), 'PP p')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 truncate">
                      {message.senderId === user?.id ? <span className="font-medium text-foreground/80">You: </span> : ''}{message.content}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                      {!message.read && message.senderId !== user?.id && <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">New</Badge>}
                      <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/messages/${otherPartyId}`)} >View Thread</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        !error && (
            <Card className="text-center py-16">
                <CardHeader>
                    <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <CardTitle>No Messages Yet</CardTitle>
                    <CardDescription>Start a conversation with a coach to see your messages here.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Link href="/browse-coaches"><Search className="mr-2 h-4 w-4" /> Find a Coach</Link>
                    </Button>
                     <Button onClick={fetchMessages} variant="outline" className="ml-2">
                        <RefreshCw className="mr-2 h-4 w-4"/> Check for Messages
                    </Button>
                </CardContent>
            </Card>
        )
      )}
    </div>
  );
}
