"use client";

import { useState, useEffect, useRef } from 'react';
import { getMessagesForConversation } from '@/lib/firestore';
import type { Message } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, AlertCircle, Send } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea'; // Assuming you might want to add a reply box later

interface AdminConversationThreadClientProps {
  conversationId: string;
}

export default function AdminConversationThreadClient({ conversationId }: AdminConversationThreadClientProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantNames, setParticipantNames] = useState<{ p1: string, p2: string }>({ p1: 'Participant 1', p2: 'Participant 2' });
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) {
      setError("No conversation ID provided.");
      setIsLoading(false);
      return;
    }

    const fetchMessages = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedMessages = await getMessagesForConversation(conversationId);
        if (fetchedMessages.length === 0) {
          setError("No messages found for this conversation, or it may not exist.");
        } else {
          setMessages(fetchedMessages);
          // Extract participant names from the first message
          const firstMsg = fetchedMessages[0];
          setParticipantNames({ p1: firstMsg.senderName, p2: firstMsg.recipientName });
        }
      } catch (err: any) {
        console.error("Error fetching conversation thread:", err);
        setError(`Failed to load messages: ${err.message || 'Please try again.'}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [conversationId]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Conversation...</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
            <Button asChild variant="outline" size="sm" className="mb-4 w-fit">
                <Link href="/dashboard/admin/messages">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to All Threads
                </Link>
            </Button>
            <CardTitle className="text-destructive flex items-center">
                <AlertCircle className="mr-3 h-6 w-6" />
                Error
            </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive/80">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full max-h-[85vh]">
        <CardHeader className="border-b">
            <div className="flex items-center gap-4">
                 <Button asChild variant="outline" size="icon" className="h-8 w-8">
                    <Link href="/dashboard/admin/messages">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Back</span>
                    </Link>
                </Button>
                <div>
                    <CardTitle>Conversation Thread</CardTitle>
                    <CardDescription>
                        Between {participantNames.p1} and {participantNames.p2}
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message, index) => {
            const isSenderP1 = message.senderName === participantNames.p1;
            // A simple way to alternate sides based on one of the participants.
            // This is NOT based on who is the "current user", just for visual separation.
            const messageAlignment = isSenderP1 ? 'items-start' : 'items-end';
            const bubbleClasses = isSenderP1 
                ? 'bg-muted/50 rounded-tl-none' 
                : 'bg-primary/10 text-primary-foreground rounded-tr-none';

            return (
                <div key={message.id || index} className={`flex flex-col gap-1 ${messageAlignment}`}>
                    <div className="flex items-center gap-2">
                         <Avatar className="h-8 w-8">
                            {/* Assuming no profile images for this view */}
                            <AvatarFallback>{getInitials(message.senderName)}</AvatarFallback>
                        </Avatar>
                        <div className="font-semibold text-sm">{message.senderName}</div>
                        <div className="text-xs text-muted-foreground">
                            {format(new Date(message.timestamp), 'MMM d, yyyy h:mm a')}
                        </div>
                    </div>
                    <div className={`p-3 rounded-lg max-w-lg ${bubbleClasses}`}>
                        <p className="text-sm">{message.content}</p>
                    </div>
                </div>
            );
        })}
        <div ref={endOfMessagesRef} />
      </CardContent>
      {/* Optional: Reply box for admin (future enhancement) */}
      {/* 
      <CardFooter className="border-t pt-6">
          <div className="flex w-full items-center gap-2">
              <Textarea placeholder="Admin reply... (feature disabled)" disabled />
              <Button disabled><Send className="h-4 w-4" /></Button>
          </div>
      </CardFooter>
      */}
    </Card>
  );
}
