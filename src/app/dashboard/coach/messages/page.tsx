
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Search, UserCircle } from "lucide-react";
import type { Message } from "@/types"; // Assuming a Message type
import { format } from "date-fns";

// Mock messages for placeholder
const mockMessages: (Message & { userName: string, userAvatar?: string, dataAiHint?: string })[] = [
  { id: '1', senderId: 'user1', receiverId: 'coach1', content: "Hello Coach, I'm interested in your services.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), read: false, userName: "Alex Johnson", userAvatar: "https://placehold.co/40x40.png", dataAiHint: "person face" },
  { id: '2', senderId: 'user2', receiverId: 'coach1', content: "I'd like to schedule a consultation.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), read: true, userName: "Samantha Lee", userAvatar: "https://placehold.co/40x40.png", dataAiHint: "woman smiling" },
  { id: '3', senderId: 'user3', receiverId: 'coach1', content: "Can you tell me more about your career coaching program?", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), read: false, userName: "Mike Brown", userAvatar: "https://placehold.co/40x40.png", dataAiHint: "man thinking" },
];


export default function CoachMessagesPage() {
  // In a real app, fetch messages for the logged-in coach
  const messages = mockMessages;

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
          {/* <div className="mb-6">
            <Input placeholder="Search messages..." className="max-w-sm" icon={<Search className="h-4 w-4" />} />
          </div> */}
        </CardContent>
      </Card>

      {messages.length > 0 ? (
        <div className="space-y-4">
          {messages.map((message) => (
            <Card key={message.id} className={`hover:shadow-md transition-shadow ${!message.read ? 'border-primary border-2' : ''}`}>
              <CardContent className="p-4 flex items-start space-x-4">
                <Avatar className="h-10 w-10 border">
                  <AvatarImage src={message.userAvatar} alt={message.userName} data-ai-hint={message.dataAiHint} />
                  <AvatarFallback>{message.userName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">{message.userName}</h3>
                    <span className="text-xs text-muted-foreground">{format(new Date(message.timestamp), 'PPpp')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 truncate">{message.content}</p>
                </div>
                <div className="flex flex-col items-end space-y-1">
                    {!message.read && <Badge variant="default" className="bg-primary text-primary-foreground">New</Badge>}
                    <Button variant="outline" size="sm">View</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
            <CardHeader>
                <CardTitle>No Messages Yet</CardTitle>
                <CardDescription>Your client messages will appear here once you start receiving inquiries.</CardDescription>
            </CardHeader>
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
