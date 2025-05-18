
"use client";

import { useAuth } from "@/lib/auth";
import { useEffect, useState, useCallback, useRef } from "react";
import { getMessagesForUser, sendMessage as sendFirestoreMessage, getUserProfile } from "@/lib/firestore";
import type { Message as MessageType, FirestoreUserProfile } from "@/types";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Loader2, AlertCircle } from "lucide-react";
import { useParams, useRouter } from 'next/navigation';
import Link from "next/link";
import { format } from "date-fns";

export default function ConversationThreadPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;

  const [messages, setMessages] = useState<MessageType[]>([]);
  const [newMessageContent, setNewMessageContent] = useState("");
  const [otherPartyProfile, setOtherPartyProfile] = useState<FirestoreUserProfile | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversationDetails = useCallback(async () => {
    if (!user || !conversationId || !user.id) {
      if (!user && !authLoading) {
        console.warn("[ConversationThreadPage] User not authenticated, redirecting to login.");
        router.push('/login');
      }
      return;
    }
    setIsLoadingMessages(true);
    setError(null);
    console.log(`[ConversationThreadPage] Fetching details for conversationId: ${conversationId}, currentUserId: ${user.id}`);

    try {
      const ids = conversationId.split('_');
      const otherPartyId = ids.find(id => id !== user.id);

      if (!otherPartyId) {
        setError("Could not determine the other party in this conversation.");
        console.error("[ConversationThreadPage] otherPartyId could not be determined from conversationId:", conversationId, "userId:", user.id);
        setIsLoadingMessages(false);
        return;
      }
      console.log(`[ConversationThreadPage] Determined otherPartyId: ${otherPartyId}`);

      let fetchedProfile: FirestoreUserProfile | null = null;
      try {
        fetchedProfile = await getUserProfile(otherPartyId);
        setOtherPartyProfile(fetchedProfile);
        console.log(`[ConversationThreadPage] Fetched otherPartyProfile: ${fetchedProfile?.name || 'Not found'}`);
      } catch (profileError: any) {
        console.error(`[ConversationThreadPage] Error fetching otherPartyProfile (${otherPartyId}):`, profileError.code, profileError.message, profileError);
        setError(`Failed to load other party's profile. Details: ${profileError.message || 'Please try again.'}`);
        setIsLoadingMessages(false); // Stop loading if profile fetch fails
        return;
      }
      
      if (!fetchedProfile) {
        setError("Could not load details for the other person in this conversation (profile not found).");
        setIsLoadingMessages(false);
        return;
      }

      let fetchedMessages: MessageType[] = [];
      try {
        fetchedMessages = await getMessagesForUser(user.id, otherPartyId);
        setMessages(fetchedMessages);
        console.log(`[ConversationThreadPage] Fetched messages count: ${fetchedMessages.length}`);
      } catch (messagesError: any) {
         console.error(`[ConversationThreadPage] Error fetching messages between ${user.id} and ${otherPartyId}:`, messagesError.code, messagesError.message, messagesError);
         setError(`Failed to load messages for the conversation. Details: ${messagesError.message || 'Please try again.'}`);
      }

    } catch (err: any) {
      console.error("[ConversationThreadPage] General error in fetchConversationDetails:", err.code, err.message, err);
      setError(`Failed to load conversation. Details: ${err.message || 'Please try again.'}`);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user, conversationId, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user && conversationId) {
      fetchConversationDetails();
    } else if (!authLoading && !user) {
       setError("Please log in to view messages.");
       setIsLoadingMessages(false);
    }
  }, [user, authLoading, conversationId, fetchConversationDetails]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newMessageContent.trim() || !user || !otherPartyProfile) {
      console.warn("[ConversationThreadPage] Send message prerequisites not met:", {newMessageContent, user, otherPartyProfile});
      return;
    }

    setIsSending(true);
    try {
      await sendFirestoreMessage({
        senderId: user.id,
        senderName: user.name || user.email || "Me",
        recipientId: otherPartyProfile.id,
        recipientName: otherPartyProfile.name || otherPartyProfile.email || "Recipient",
        content: newMessageContent,
      });
      setNewMessageContent("");
      fetchConversationDetails(); 
    } catch (err) {
      console.error("[ConversationThreadPage] Error sending message:", err);
      setError("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };
  
  const isLoading = authLoading || isLoadingMessages;

  if (isLoading && !error) {
     return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /> Loading conversation...</div>;
  }
  
  if (!user && !authLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
        <p className="text-muted-foreground mb-4">Please log in to view your messages.</p>
        <Button asChild><Link href={`/login?redirect=/dashboard/messages/${conversationId}`}>Log In</Link></Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Conversation</h2>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Messages
        </Button>
      </div> // Corrected closing tag here
    );
  }

  if (!otherPartyProfile && !isLoading) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center p-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Conversation Partner Not Found</h2>
        <p className="text-muted-foreground mb-4">Could not load details for the other person in this conversation.</p>
        <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Messages
        </Button>
      </div>
    );
  }


  return (
    <Card className="h-[calc(100vh-10rem)] md:h-[calc(100vh-12rem)] flex flex-col shadow-xl">
      <CardHeader className="p-4 border-b flex flex-row items-center gap-3">
        <Button variant="ghost" size="icon" className="mr-2" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {otherPartyProfile?.profileImageUrl && (
            <Avatar className="h-10 w-10">
                <AvatarImage src={otherPartyProfile.profileImageUrl} alt={otherPartyProfile.name || ''} data-ai-hint="person avatar" />
                <AvatarFallback>{otherPartyProfile.name?.substring(0,1).toUpperCase() || '?'}</AvatarFallback>
            </Avatar>
        )}
         {!otherPartyProfile?.profileImageUrl && otherPartyProfile && (
           <Avatar className="h-10 w-10">
             <AvatarFallback>{otherPartyProfile.name?.substring(0,1).toUpperCase() || '?'}</AvatarFallback>
           </Avatar>
         )}
        <CardTitle className="text-xl">{otherPartyProfile?.name || 'Conversation'}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${
                msg.senderId === user?.id ? "justify-end" : "justify-start"
              }`}
            >
              {msg.senderId !== user?.id && otherPartyProfile?.profileImageUrl && (
                <Avatar className="h-8 w-8 self-start">
                  <AvatarImage src={otherPartyProfile.profileImageUrl} alt={otherPartyProfile.name || ''} data-ai-hint="person avatar"/>
                  <AvatarFallback>{otherPartyProfile.name?.substring(0,1).toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
              )}
               {msg.senderId !== user?.id && !otherPartyProfile?.profileImageUrl && otherPartyProfile && (
                 <Avatar className="h-8 w-8 self-start">
                  <AvatarFallback>{otherPartyProfile.name?.substring(0,1).toUpperCase() || '?'}</AvatarFallback>
                </Avatar>
               )}

              <div
                className={`max-w-[70%] p-3 rounded-xl shadow ${
                  msg.senderId === user?.id
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-muted rounded-bl-none"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${ msg.senderId === user?.id ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground/70 text-left'}`}>
                  {format(new Date(msg.timestamp), "p")}
                </p>
              </div>

              {msg.senderId === user?.id && user?.profileImageUrl && (
                 <Avatar className="h-8 w-8 self-start">
                  <AvatarImage src={user.profileImageUrl} alt={user.name || "My Avatar"} data-ai-hint="person avatar"/>
                  <AvatarFallback>{(user.name || "Me").substring(0,1).toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
               {msg.senderId === user?.id && !user?.profileImageUrl && user && (
                 <Avatar className="h-8 w-8 self-start">
                   <AvatarFallback>{(user.name || "Me").substring(0,1).toUpperCase()}</AvatarFallback>
                </Avatar>
               )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t bg-card sticky bottom-0">
        <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
          <Textarea
            value={newMessageContent}
            onChange={(e) => setNewMessageContent(e.target.value)}
            placeholder="Type your message..."
            className="resize-none flex-1 min-h-[40px] max-h-[120px]"
            rows={1}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e as any); // Submit form
                }
            }}
          />
          <Button type="submit" disabled={isSending || !newMessageContent.trim()} size="icon">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send Message</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
