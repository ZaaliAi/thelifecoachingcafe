
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Search } from "lucide-react";
import type { Message } from "@/types"; // Assuming a Message type
import { format } from "date-fns";
import Link from "next/link";

// Mock messages for placeholder (user's perspective) - replace with Firestore
const mockUserMessages: (Message & { otherPartyName: string, otherPartyAvatar?: string, dataAiHint?: string })[] = [
  { id: 'um1', senderId: 'coach1', receiverId: 'user1', content: "Hi Alex, thanks for reaching out! Happy to discuss your career goals.", timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(), read: false, otherPartyName: "Dr. Eleanor Vance", otherPartyAvatar: "https://placehold.co/40x40.png", dataAiHint: "professional woman" },
  { id: 'um2', senderId: 'user1', receiverId: 'coach2', content: "Just confirming our consultation for tomorrow.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(), read: true, otherPartyName: "Marcus Chen", otherPartyAvatar: "https://placehold.co/40x40.png", dataAiHint: "confident man" },
  { id: 'um3', senderId: 'coach3', receiverId: 'user1', content: "Following up on our last session, here are the resources we discussed.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(), read: true, otherPartyName: "Aisha Khan", otherPartyAvatar: "https://placehold.co/40x40.png", dataAiHint: "smiling woman" },
];


export default function UserMessagesPage() {
  // In a real app, fetch messages for the logged-in user from Firestore
  const messages = mockUserMessages; // Replace this

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
                <CardTitle className="text-3xl flex items-center">
                    <MessageSquare className="mr-3 h-8 w-8 text-primary" />
                    My Messages
                </CardTitle>
                <CardDescription>Your conversations with coaches.</CardDescription>
            </div>
            <Button asChild className="mt-4 sm:mt-0 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/find-a-coach"><Search className="mr-2 h-4 w-4"/>Find a Coach to Message</Link>
            </Button>
        </CardHeader>
        <CardContent>
          {/* Optional: Add search/filter for messages */}
        </CardContent>
      </Card>

      {messages.length > 0 ? (
        <div className="space-y-4">
          {messages.map((message) => (
            <Card key={message.id} className={`hover:shadow-md transition-shadow ${!message.read && message.senderId !== 'user1' ? 'border-primary border-2' : ''}`}> {/* Assuming current user ID is 'user1' */}
              <CardContent className="p-4 flex items-start space-x-4">
                {message.otherPartyAvatar && (
                  <Avatar className="h-10 w-10 border">
                    <AvatarImage src={message.otherPartyAvatar} alt={message.otherPartyName} data-ai-hint={message.dataAiHint} />
                    <AvatarFallback>{message.otherPartyName.charAt(0)}</AvatarFallback>
                  </Avatar>
                )}
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">{message.otherPartyName}</h3>
                    <span className="text-xs text-muted-foreground">{format(new Date(message.timestamp), 'PPpp')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {message.senderId === 'user1' ? 'You: ' : ''}{message.content}
                  </p>
                </div>
                <div className="flex flex-col items-end space-y-1">
                    {!message.read && message.senderId !== 'user1' && <Badge variant="default" className="bg-primary text-primary-foreground">New</Badge>}
                    <Button variant="outline" size="sm">View Thread</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
            <CardHeader>
                <CardTitle>No Messages Yet</CardTitle>
                <CardDescription>Start a conversation with a coach to see your messages here.</CardDescription>
            </CardHeader>
             <CardContent>
                <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Link href="/find-a-coach"><Search className="mr-2 h-4 w-4" /> Find a Coach</Link>
                </Button>
            </CardContent>
        </Card>
      )}
       {/* Pagination Placeholder */}
      {messages.length > 0 && (
        <div className="mt-8 flex justify-center">
          <Button variant="outline" disabled>Load More Messages</Button>
        </div>
      )}
    </div>
  );
}
