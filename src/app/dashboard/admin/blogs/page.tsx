
"use client"; // For client-side actions

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, FileText, Eye, Loader2 } from "lucide-react";
import { mockBlogPosts } from '@/data/mock';
import type { BlogPost } from '@/types';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function AdminManageBlogsPage() {
  const [blogSubmissions, setBlogSubmissions] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Simulate fetching blog submissions
    // In a real app, fetch posts with status 'pending_approval' or all posts for management
    setBlogSubmissions(mockBlogPosts); 
    setIsLoading(false);
  }, []);

  const handleApproval = (postId: string, newStatus: 'published' | 'rejected') => {
    // Simulate API call
    setBlogSubmissions(prev => 
      prev.map(post => post.id === postId ? { ...post, status: newStatus } : post)
    );
    toast({
      title: `Blog Post ${newStatus}`,
      description: `Blog post "${blogSubmissions.find(p=>p.id===postId)?.title}" has been ${newStatus}.`,
    });
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Loading blog submissions...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <FileText className="mr-3 h-7 w-7 text-primary" /> Manage Blog Submissions
        </CardTitle>
        <CardDescription>Review, approve, or reject blog posts submitted by coaches.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Submitted On</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blogSubmissions.map((post) => (
              <TableRow key={post.id}>
                <TableCell className="font-medium max-w-xs truncate">{post.title}</TableCell>
                <TableCell>{post.authorName}</TableCell>
                <TableCell>{format(new Date(post.createdAt), 'PP')}</TableCell>
                <TableCell>
                  <Badge 
                    variant={post.status === 'published' ? 'default' : post.status === 'pending_approval' ? 'secondary' : 'destructive'}
                  >
                    {post.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer">
                      <Eye className="mr-1 h-4 w-4" /> Preview
                    </Link>
                  </Button>
                  {post.status === 'pending_approval' && (
                    <>
                      <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-100" onClick={() => handleApproval(post.id, 'published')}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                      </Button>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-100" onClick={() => handleApproval(post.id, 'rejected')}>
                        <XCircle className="mr-1 h-4 w-4" /> Reject
                      </Button>
                    </>
                  )}
                   {post.status === 'published' && (
                     <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-100" onClick={() => handleApproval(post.id, 'rejected')}>
                        <XCircle className="mr-1 h-4 w-4" /> Unpublish
                      </Button>
                   )}
                    {post.status === 'rejected' && (
                     <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-100" onClick={() => handleApproval(post.id, 'published')}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Re-approve
                      </Button>
                   )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {blogSubmissions.length === 0 && <p className="text-center text-muted-foreground py-8">No blog submissions found.</p>}
      </CardContent>
    </Card>
  );
}
