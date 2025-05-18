
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"; 
import { ArrowLeft, MessageCircle, Send, UserCircleIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useEffect, useState, useCallback, useRef } from "react";
// Removed markMessagesAsRead from here as it's called within getMessagesForUser
import { getMessagesForUser, sendMessage as sendFirestoreMessage, getUserProfile, getCoachById } from "@/lib/firestore"; 
import type { Message as MessageType, FirestoreUserProfile, Coach } from "@/types";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

export default function ConversationThreadPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const conversationId = params.conversationId as string; 
  
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [newMessageContent, setNewMessageContent] = useState("");
  const [otherParty, setOtherParty] = useState<{ name: string; avatar?: string | null, dataAiHint?: string | null }>({ name: "Contact" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const fetchConversationDetails = useCallback(async () => {
    if (!user || !user.id || !conversationId) {
        setIsLoading(false);
        if (!authLoading && !user) {
             toast({ title: "Error", description: "User not authenticated. Cannot load conversation.", variant: "destructive" });
        }
        return;
    }
    console.log(`[ConversationThreadPage] Fetching details for user: ${user.id}, other party: ${conversationId}`);
    setIsLoading(true);
    try {
      let otherPartyProfile: (FirestoreUserProfile & { id: string }) | Coach | null = null;
      if (user.role === 'coach') { 
        otherPartyProfile = await getUserProfile(conversationId);
      } else { 
        otherPartyProfile = await getCoachById(conversationId);
      }
      
      if (otherPartyProfile) {
        console.log(`[ConversationThreadPage] Found other party: ${otherPartyProfile.name}`);
        setOtherParty({ name: otherPartyProfile.name || "Unknown Contact", avatar: otherPartyProfile.profileImageUrl, dataAiHint: otherPartyProfile.dataAiHint });
      } else {
        console.warn(`[ConversationThreadPage] Could not find profile for other party ID: ${conversationId}`);
        toast({ title: "Error", description: "Could not load contact details for this conversation.", variant: "destructive" });
        setOtherParty({ name: "Unknown Contact" });
      }

      // getMessagesForUser now internally handles marking messages as read
      const allUserMessages = await getMessagesForUser(user.id, conversationId); 
      console.log(`[ConversationThreadPage] Fetched ${allUserMessages.length} total messages for user ${user.id} with specific otherPartyId ${conversationId}`);
      
      const threadMessages = allUserMessages.filter(
        (msg) => msg.otherPartyId === conversationId // This filter might be redundant if getMessagesForUser already does it
      ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      console.log(`[ConversationThreadPage] Filtered to ${threadMessages.length} messages for conversation with ${conversationId}`);
      setMessages(threadMessages);

    } catch (error) {
      console.error("[ConversationThreadPage] Error fetching conversation details:", error);
      toast({ title: "Error Loading Conversation", description: "Could not load conversation details. Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, conversationId, toast, authLoading]); // Added toast to dependencies

  useEffect(() => {
    if (!authLoading && user && user.id) {
      fetchConversationDetails();
    } else if (!authLoading && !user) {
      toast({ title: "Authentication Required", description: "Please log in to view messages.", variant: "destructive" });
      // Determine redirect based on typical user paths if needed, or a generic login
      // const loginPath = router.pathname?.includes('/dashboard/coach') ? '/login?role=coach' : '/login';
      router.push(`/login?redirect=/dashboard/messages/${conversationId}`);
    }
  }, [user, authLoading, fetchConversationDetails, router, toast, conversationId]); 

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageContent.trim() || !user || !user.id || !conversationId || !otherParty.name) {
      toast({title: "Cannot Send", description: "Message is empty or recipient details are missing.", variant: "destructive"});
      return;
    }
    setIsSending(true);
    try {
      await sendFirestoreMessage({
        senderId: user.id,
        senderName: user.name || user.email?.split('@')[0] || "Me",
        recipientId: conversationId,
        recipientName: otherParty.name, // Use fetched other party name
        content: newMessageContent,
      });
      setNewMessageContent("");
      fetchConversationDetails(); // Re-fetch messages to show the new one and mark as read
    } catch (error) {
      console.error("[ConversationThreadPage] Error sending message:", error);
      toast({ title: "Send Error", description: "Could not send message. Please try again.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const backLink = user?.role === 'coach' ? '/dashboard/coach/messages' : '/dashboard/user/messages';

  if (authLoading || isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /> Loading conversation...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-w-3xl mx-auto">
      <Card className="flex flex-col flex-grow overflow-hidden shadow-lg">
        <CardHeader className="border-b p-4 sticky top-0 bg-card z-10">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" asChild className="mr-2">
              <Link href={backLink} aria-label="Back to messages">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-3 flex-grow min-w-0">
              {otherParty.avatar ? (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={otherParty.avatar} alt={otherParty.name} data-ai-hint={otherParty.dataAiHint || "person avatar"}/>
                  <AvatarFallback>{otherParty.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              ) : (
                <UserCircleIcon className="h-8 w-8 text-muted-foreground" />
              )}
              <CardTitle className="text-lg truncate">{otherParty.name}</CardTitle>
            </div>
            <div className="w-8"> 
            </div>
          </div>
        </CardHeader>
        
        <ScrollArea className="flex-grow p-4 space-y-4 bg-muted/5">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-10">
              <MessageCircle className="mx-auto h-12 w-12 mb-4" />
              <p>No messages in this conversation yet.</p>
              <p>Start by sending a message below.</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex mb-3 ${msg.senderId === user?.id ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] p-3 rounded-xl shadow-sm break-words ${
                  msg.senderId === user?.id
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-card text-card-foreground border rounded-bl-none"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.senderId === user?.id ? "text-primary-foreground/70 text-right" : "text-muted-foreground text-left"}`}>
                  {format(new Date(msg.timestamp), "p")} {!msg.read && msg.recipientId === user?.id && <span className="text-xs text-green-400 ml-1">(Delivered)</span>}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </ScrollArea>
        
        <CardFooter className="p-4 border-t bg-card sticky bottom-0">
          <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
            <Textarea
              value={newMessageContent}
              onChange={(e) => setNewMessageContent(e.target.value)}
              placeholder="Type your message..."
              className="flex-grow resize-none"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              disabled={authLoading || isLoading}
            />
            <Button type="submit" disabled={isSending || !newMessageContent.trim() || authLoading || isLoading} className="bg-primary hover:bg-primary/80">
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
