
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Filter } from "lucide-react";
import type { Message } from "@/types"; // Assuming a Message type
import { format } from "date-fns";
import { Input } from "@/components/ui/input";

// Mock messages for placeholder
const mockMessageLogs: (Message & { senderName: string, receiverName: string })[] = [
  { id: 'log1', senderId: 'user1', receiverId: 'coach1', content: "Hello Coach, I'm interested in your services.", timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), read: false, senderName: "Alex J.", receiverName: "Dr. Vance" },
  { id: 'log2', senderId: 'coach1', receiverId: 'user1', content: "Hi Alex, thanks for reaching out! How can I help?", timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(), read: true, senderName: "Dr. Vance", receiverName: "Alex J." },
  { id: 'log3', senderId: 'user2', receiverId: 'coach2', content: "I'd like to schedule a consultation.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), read: true, senderName: "Sam L.", receiverName: "Marcus C." },
  { id: 'log4', senderId: 'user3', receiverId: 'coach1', content: "Can you tell me more about your career coaching program? It looks really interesting and relevant to my current situation.", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), read: false, senderName: "Mike B.", receiverName: "Dr. Vance" },
];


export default function AdminMessageLogsPage() {
  // In a real app, fetch message logs with pagination and filtering
  const messageLogs = mockMessageLogs;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <MessageSquare className="mr-3 h-7 w-7 text-primary" />
          Message Logs
        </CardTitle>
        <CardDescription>Monitor platform messaging for moderation and support purposes.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <Input placeholder="Search by user, coach, or content..." className="flex-grow" />
          <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Filter</Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Sender</TableHead>
              <TableHead>Receiver</TableHead>
              <TableHead>Content Snippet</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messageLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-xs text-muted-foreground">{format(new Date(log.timestamp), 'PPpp')}</TableCell>
                <TableCell>{log.senderName}</TableCell>
                <TableCell>{log.receiverName}</TableCell>
                <TableCell className="max-w-xs truncate">{log.content}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm">View Full</Button>
                  {/* Add moderation actions if needed, e.g., flag, delete */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {messageLogs.length === 0 && <p className="text-center text-muted-foreground py-8">No message logs found.</p>}

        {/* Pagination Placeholder */}
        {messageLogs.length > 0 && (
            <div className="mt-8 flex justify-center">
            <Button variant="outline" disabled>Load More Logs</Button>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
