
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Filter, Loader2, AlertCircle } from "lucide-react";
import type { Message } from "@/types";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { getAllMessagesForAdmin } from '@/lib/firestore';

export default function AdminMessageLogsPage() {
  const [messageLogs, setMessageLogs] = useState<(Message & { senderName?: string, recipientName?: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedMessages = await getAllMessagesForAdmin();
        // mapMessageFromFirestore (used by getAllMessagesForAdmin) should provide senderName & recipientName
        setMessageLogs(fetchedMessages as (Message & { senderName?: string, recipientName?: string })[]);
      } catch (err) {
        console.error("Error fetching admin message logs:", err);
        setError("Failed to load message logs. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchMessages();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <MessageSquare className="mr-3 h-7 w-7 text-primary" />
            Message Logs
          </CardTitle>
          <CardDescription>Monitor platform messaging for moderation and support purposes.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading message logs...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="text-center py-12 bg-destructive/10 border-destructive">
        <CardHeader>
          <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
          <CardTitle className="text-destructive">Error Loading Message Logs</CardTitle>
          <CardDescription className="text-destructive/80">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => { 
            // Basic refetch functionality for try again
            const fetchMessages = async () => {
                setIsLoading(true);
                setError(null);
                try {
                    const fetchedMessages = await getAllMessagesForAdmin();
                    setMessageLogs(fetchedMessages as (Message & { senderName?: string, recipientName?: string })[]);
                } catch (err) {
                    console.error("Error fetching admin message logs:", err);
                    setError("Failed to load message logs. Please try again later.");
                } finally {
                    setIsLoading(false);
                }
            };
            fetchMessages();
           }} variant="outline">
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
                <TableCell>{log.senderName || log.senderId}</TableCell>
                <TableCell>{log.recipientName || log.recipientId}</TableCell>
                <TableCell className="max-w-xs truncate">{log.content}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm">View Full</Button>
                  {/* Add moderation actions if needed, e.g., flag, delete */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {messageLogs.length === 0 && !isLoading && (
            <p className="text-center text-muted-foreground py-8">No message logs found.</p>
        )}

        {/* Pagination Placeholder - Consider implementing actual pagination */}
        {messageLogs.length > 0 && (
            <div className="mt-8 flex justify-center">
            <Button variant="outline" disabled>Load More Logs</Button> {/* TODO: Implement pagination */} 
            </div>
        )}
      </CardContent>
    </Card>
  );
}
