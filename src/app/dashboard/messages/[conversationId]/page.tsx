
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MessageCircle, Send, UserCircleIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useEffect, useState, useCallback, useRef } from "react";
import { getMessagesForUser, sendMessage as sendFirestoreMessage, getUserProfile, getCoachById } from "@/lib/firestore"; // Assuming you'll need these
import type { Message as MessageType } from "@/types";
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
  
  const conversationId = params.conversationId as string; // This is the otherPartyId
  
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [newMessageContent, setNewMessageContent] = useState("");
  const [otherParty, setOtherParty] = useState<{ name: string; avatar?: string | null, dataAiHint?: string }>({ name: "Contact" });
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
        return;
    }
    setIsLoading(true);
    try {
      // Fetch other party's details
      let otherPartyProfile = await getUserProfile(conversationId);
      if (!otherPartyProfile) {
        const coachProfile = await getCoachById(conversationId);
        if (coachProfile) {
            otherPartyProfile = { ...coachProfile, id: coachProfile.id, email: coachProfile.email || "", role: 'coach', createdAt: new Date(), updatedAt: new Date() }; // Adapt Coach to FirestoreUserProfile shape
        }
      }
      if (otherPartyProfile) {
        setOtherParty({ name: otherPartyProfile.name || "Unknown Contact", avatar: otherPartyProfile.profileImageUrl, dataAiHint: otherPartyProfile.dataAiHint });
      }

      // Fetch messages (getMessagesForUser fetches all for the user, then we filter)
      const allUserMessages = await getMessagesForUser(user.id);
      const threadMessages = allUserMessages.filter(
        (msg) => msg.senderId === conversationId || msg.recipientId === conversationId
      ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      setMessages(threadMessages);

    } catch (error) {
      console.error("Error fetching conversation details:", error);
      toast({ title: "Error", description: "Could not load conversation.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, conversationId, toast]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchConversationDetails();
    }
  }, [user, authLoading, fetchConversationDetails]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageContent.trim() || !user || !conversationId || !otherParty.name) {
      return;
    }
    setIsSending(true);
    try {
      await sendFirestoreMessage({
        senderId: user.id,
        senderName: user.name || user.email?.split('@')[0] || "Me",
        recipientId: conversationId,
        recipientName: otherParty.name,
        content: newMessageContent,
      });
      setNewMessageContent("");
      fetchConversationDetails(); // Refresh messages
    } catch (error) {
      console.error("Error sending message:", error);
      toast({ title: "Send Error", description: "Could not send message.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

  const backLink = user?.role === 'coach' ? '/dashboard/coach/messages' : '/dashboard/user/messages';

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /> Loading conversation...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-w-3xl mx-auto"> {/* Adjust height as needed */}
      <Card className="flex flex-col flex-grow overflow-hidden">
        <CardHeader className="border-b p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => router.push(backLink)} className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              {otherParty.avatar ? (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={otherParty.avatar} alt={otherParty.name} data-ai-hint={otherParty.dataAiHint || "person avatar"}/>
                  <AvatarFallback>{otherParty.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              ) : (
                <UserCircleIcon className="h-8 w-8 text-muted-foreground" />
              )}
              <CardTitle className="text-lg">{otherParty.name}</CardTitle>
            </div>
            <div className="w-8"> {/* Spacer */}</div>
          </div>
        </CardHeader>
        
        <ScrollArea className="flex-grow p-4 space-y-4 bg-muted/20">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex mb-3 ${msg.senderId === user?.id ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[70%] p-3 rounded-xl shadow-sm ${
                  msg.senderId === user?.id
                    ? "bg-primary text-primary-foreground rounded-br-none"
                    : "bg-card text-card-foreground border rounded-bl-none"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.senderId === user?.id ? "text-primary-foreground/70 text-right" : "text-muted-foreground text-left"}`}>
                  {format(new Date(msg.timestamp), "p")}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </ScrollArea>
        
        <CardFooter className="p-4 border-t">
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
            />
            <Button type="submit" disabled={isSending || !newMessageContent.trim()} className="bg-primary hover:bg-primary/80">
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}
