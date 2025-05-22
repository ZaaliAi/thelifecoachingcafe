"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Filter, Loader2, AlertCircle, Users, Eye } from "lucide-react"; // Added Users, Eye
import type { Message } from "@/types";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { getAllMessagesForAdmin } from '@/lib/firestore';

interface AdminConversationView {
  id: string; // conversationId
  participant1Id: string;
  participant1Name: string;
  participant2Id: string;
  participant2Name: string;
  lastMessageTimestamp: string;
  lastMessageSnippet: string;
  totalMessages: number;
  // Consider adding unread count for admin if relevant, though less common for logs
}

export default function AdminMessageLogsPage() {
  const [conversationThreads, setConversationThreads] = useState<AdminConversationView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchAndProcessMessages = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const rawMessages = await getAllMessagesForAdmin(200); // Fetch more messages to build threads

        const threadsMap = new Map<string, AdminConversationView>();
        const messagesByConversation = new Map<string, Message[]>();

        // Group messages by conversationId
        for (const msg of rawMessages) {
          if (!msg.conversationId) {
            console.warn("Message missing conversationId, skipping:", msg.id);
            continue;
          }
          const currentMessages = messagesByConversation.get(msg.conversationId) || [];
          messagesByConversation.set(msg.conversationId, [...currentMessages, msg]);
        }

        // Process each conversation
        messagesByConversation.forEach((messagesInConv, conversationId) => {
          if (messagesInConv.length === 0) return;

          // Sort messages to find the latest one easily
          messagesInConv.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          const lastMessage = messagesInConv[0];

          // Determine participants - this assumes sender/recipient names are consistent across a thread
          // or picks from the last message. Robustly, you might get user details from a user store.
          let p1Id = lastMessage.senderId;
          let p1Name = lastMessage.senderName || 'Unknown User';
          let p2Id = lastMessage.recipientId;
          let p2Name = lastMessage.recipientName || 'Unknown User';
          
          // Normalize to ensure consistent participant order if needed, though for display it might not matter
          // For simplicity, we'll use sender/recipient from the last message as P1/P2

          threadsMap.set(conversationId, {
            id: conversationId,
            participant1Id: p1Id,
            participant1Name: p1Name,
            participant2Id: p2Id,
            participant2Name: p2Name,
            lastMessageTimestamp: lastMessage.timestamp,
            lastMessageSnippet: lastMessage.content.substring(0, 75) + (lastMessage.content.length > 75 ? '...' : ''),
            totalMessages: messagesInConv.length,
          });
        });
        
        const sortedThreads = Array.from(threadsMap.values()).sort((a,b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());
        setConversationThreads(sortedThreads);

      } catch (err) {
        console.error("Error fetching or processing admin message logs:", err);
        setError("Failed to load message logs. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchAndProcessMessages();
  }, []);

  const filteredThreads = conversationThreads.filter(thread =>
    thread.participant1Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    thread.participant2Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    thread.lastMessageSnippet.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Loading and Error states remain similar to before, just update titles/text
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <MessageSquare className="mr-3 h-7 w-7 text-primary" />
            Conversation Logs
          </CardTitle>
          <CardDescription>View conversation threads between users and coaches.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading conversations...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="text-center py-12 bg-destructive/10 border-destructive">
        <CardHeader>
          <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
          <CardTitle className="text-destructive">Error Loading Conversations</CardTitle>
          <CardDescription className="text-destructive/80">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => { /* Implement refetch logic */ }} variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <Users className="mr-3 h-7 w-7 text-primary" /> {/* Changed Icon */}
          Conversation Threads
        </CardTitle>
        <CardDescription>Overview of message threads on the platform.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <Input 
            placeholder="Search by participant name or message snippet..." 
            className="flex-grow" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {/* <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Filter</Button> */}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Participants</TableHead>
              <TableHead>Last Message</TableHead>
              <TableHead className="text-center">Total Messages</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredThreads.map((thread) => (
              <TableRow key={thread.id}>
                <TableCell>
                  <div className="font-medium">{thread.participant1Name}</div>
                  <div className="text-xs text-muted-foreground">vs {thread.participant2Name}</div>
                </TableCell>
                <TableCell>
                    <p className="max-w-xs truncate text-sm">{thread.lastMessageSnippet}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(thread.lastMessageTimestamp), 'PPpp')}</p>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{thread.totalMessages}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {/* This link is a placeholder. You'll need a page for /dashboard/admin/messages/[conversationId] */}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/admin/messages/${thread.id}`}> 
                      <Eye className="mr-1.5 h-4 w-4" /> View Thread
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredThreads.length === 0 && !isLoading && (
            <p className="text-center text-muted-foreground py-8">No conversation threads found.</p>
        )}
        {/* Pagination can be added here if needed */}
      </CardContent>
    </Card>
  );
}
