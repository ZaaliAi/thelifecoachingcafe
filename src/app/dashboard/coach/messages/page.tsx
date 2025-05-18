
"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Loader2, AlertCircle } from "lucide-react";
import type { Message as MessageType } from "@/types"; // Renamed to avoid conflict
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { getMessagesForUser } from "@/lib/firestore";

export default function CoachMessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [messages, setMessages] = useState<any[]>([]); // Using any for now
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.id && user.role === 'coach') {
      setIsLoadingMessages(true);
      setError(null);
      getMessagesForUser(user.id)
        .then(fetchedMessages => {
          const processedMessages = fetchedMessages.map(msg => ({
            ...msg,
            otherPartyName: msg.senderId === user.id ? msg.recipientName : msg.senderName,
            // otherPartyAvatar: "https://placehold.co/40x40.png", // Placeholder
            // dataAiHint: "person avatar"
          }));
          setMessages(processedMessages);
        })
        .catch(err => {
          console.error("Error fetching coach messages:", err);
          setError("Failed to load messages.");
        })
        .finally(() => {
          setIsLoadingMessages(false);
        });
    } else if (!authLoading && (!user || user.role !== 'coach')) {
      setIsLoadingMessages(false);
      setError("Please log in as a coach to view your messages.");
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
        <CardHeader>
          <CardTitle className="text-3xl flex items-center">
            <MessageSquare className="mr-3 h-8 w-8 text-primary" />
            Client Messages
          </CardTitle>
          <CardDescription>View and respond to messages from potential and current clients.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Add search/filter for messages if needed */}
        </CardContent>
      </Card>

      {error && (
         <Card className="text-center py-12 bg-destructive/10 border-destructive">
          <CardHeader>
            <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription className="text-destructive/80">{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {!error && messages.length > 0 ? (
        <div className="space-y-4">
          {messages.map((message) => (
            <Card key={message.id} className={`hover:shadow-md transition-shadow ${!message.read && message.senderId !== user?.id ? 'border-primary border-2' : ''}`}>
              <CardContent className="p-4 flex items-start space-x-4">
                {message.otherPartyAvatar && (
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={message.otherPartyAvatar} alt={message.otherPartyName || 'User'} data-ai-hint={message.dataAiHint as string || 'person avatar'} />
                    <AvatarFallback>{message.otherPartyName?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">{message.otherPartyName || (message.senderId === user?.id ? "To: " + message.recipientName : "From: " + message.senderName)}</h3>
                    <span className="text-xs text-muted-foreground">{format(new Date(message.timestamp), 'PPpp')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                     {message.senderId === user?.id ? 'You: ' : ''}{message.content}
                  </p>
                </div>
                <div className="flex flex-col items-end space-y-1">
                    {!message.read && message.senderId !== user?.id && <Badge variant="default" className="bg-primary text-primary-foreground">New</Badge>}
                    <Button variant="outline" size="sm" disabled>View (Soon)</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
         !error && (
            <Card className="text-center py-12">
                <CardHeader>
                    <CardTitle>No Messages Yet</CardTitle>
                    <CardDescription>Your client messages will appear here once you start receiving inquiries.</CardDescription>
                </CardHeader>
            </Card>
         )
      )}
      {!error && messages.length > 0 && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" disabled>Load More Messages (Soon)</Button>
        </div>
      )}
    </div>
  );
}
