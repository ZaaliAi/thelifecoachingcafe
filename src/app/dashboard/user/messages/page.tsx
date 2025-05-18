
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Search, Loader2, AlertCircle, Info } from "lucide-react";
import type { Message as MessageType } from "@/types";
import { format } from "date-fns";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { getMessagesForUser, getCoachById, getUserProfile } from "@/lib/firestore"; // Assuming getUserProfile can fetch basic user info by ID

export default function UserMessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<MessageType[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.id) {
      setIsLoadingMessages(true);
      setError(null);
      getMessagesForUser(user.id)
        .then(async (fetchedMessages) => {
          // Group messages by other party and get the latest message for each conversation
          const convosMap = new Map<string, MessageType>();
          for (const msg of fetchedMessages) {
            const otherPartyId = msg.senderId === user.id ? msg.recipientId : msg.senderId;
            if (!convosMap.has(otherPartyId) || new Date(msg.timestamp) > new Date(convosMap.get(otherPartyId)!.timestamp)) {
              // Attempt to fetch the other party's profile image if not already on the message
              let otherPartyAvatar = null;
              // Try fetching as coach first, then as general user if needed
              const coachProfile = await getCoachById(otherPartyId);
              if (coachProfile && coachProfile.profileImageUrl) {
                otherPartyAvatar = coachProfile.profileImageUrl;
              } else {
                const userProfile = await getUserProfile(otherPartyId);
                if (userProfile && userProfile.profileImageUrl) {
                  otherPartyAvatar = userProfile.profileImageUrl;
                }
              }

              convosMap.set(otherPartyId, {
                ...msg,
                otherPartyName: msg.senderId === user.id ? msg.recipientName : msg.senderName,
                otherPartyAvatar: otherPartyAvatar || undefined, // Use fetched avatar or undefined
                dataAiHint: "person avatar" // Default hint
              });
            }
          }
          setConversations(Array.from(convosMap.values()).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        })
        .catch(err => {
          console.error("Error fetching user messages:", err);
          setError("Failed to load your messages.");
        })
        .finally(() => {
          setIsLoadingMessages(false);
        });
    } else if (!authLoading && !user) {
      setIsLoadingMessages(false);
      setError("Please log in to view your messages.");
    }
  }, [user, authLoading]);


  if (authLoading || isLoadingMessages) {
    return (
      <div className="flex justify-center items-center h-full min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading messages...</span>
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
                <CardDescription>Your conversations with coaches. Click to view full thread (feature coming soon).</CardDescription>
            </div>
            <Button asChild className="mt-4 sm:mt-0 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/find-a-coach"><Search className="mr-2 h-4 w-4"/>Find a Coach to Message</Link>
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
        </Card>
      )}

      {!error && conversations.length > 0 ? (
        <div className="space-y-4">
          {conversations.map((message) => (
            // Each card could eventually link to a full conversation view: /dashboard/user/messages/[conversationId]
            <Card key={message.id} className={`hover:shadow-md transition-shadow ${!message.read && message.senderId !== user?.id ? 'border-primary border-2' : ''}`}>
              <CardContent className="p-4 flex items-start space-x-4">
                {message.otherPartyAvatar && (
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={message.otherPartyAvatar} alt={message.otherPartyName || 'User'} data-ai-hint={message.dataAiHint as string || 'person avatar'} />
                    <AvatarFallback>{message.otherPartyName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                )}
                {!message.otherPartyAvatar && (
                     <Avatar className="h-10 w-10 border">
                        <AvatarFallback>{message.otherPartyName?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                )}
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">{message.otherPartyName || (message.senderId === user?.id ? "To: " + message.recipientName : "From: " + message.senderName)}</h3>
                    <span className="text-xs text-muted-foreground">{format(new Date(message.timestamp), 'PPpp')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {message.senderId === user?.id ? <span className="font-medium">You: </span> : ''}{message.content}
                  </p>
                </div>
                <div className="flex flex-col items-end space-y-1">
                    {!message.read && message.senderId !== user?.id && <Badge variant="default" className="bg-primary text-primary-foreground">New</Badge>}
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
                    <CardDescription>Start a conversation with a coach to see your messages here.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Link href="/find-a-coach"><Search className="mr-2 h-4 w-4" /> Find a Coach</Link>
                    </Button>
                </CardContent>
            </Card>
        )
      )}
    </div>
  );
}
