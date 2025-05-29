
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, FileText, Eye, Loader2, Trash2, AlertTriangle } from "lucide-react";
import type { BlogPost, FirestoreBlogPost } from '@/types';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { getAllBlogPostsForAdmin, updateBlogPostStatus, deleteFirestoreBlogPost } from '@/lib/firestore';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminManageBlogsPage() {
  const [blogSubmissions, setBlogSubmissions] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPosts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const posts = await getAllBlogPostsForAdmin();
      setBlogSubmissions(posts);
    } catch (err) {
      console.error("Error fetching blog posts for admin:", err);
      setError("Failed to load blog submissions. Please try again.");
      toast({
        title: "Error Loading Posts",
        description: "Could not fetch blog submissions.",
        variant: "destructive"
      });
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleStatusUpdate = async (postId: string, newStatus: FirestoreBlogPost['status']) => {
    const originalPosts = [...blogSubmissions];
    const postToUpdate = blogSubmissions.find(p => p.id === postId);
    if (!postToUpdate) return;

    setBlogSubmissions(prev => 
      prev.map(post => post.id === postId ? { ...post, status: newStatus } : post)
    );

    try {
      await updateBlogPostStatus(postId, newStatus);
      toast({
        title: `Blog Post ${newStatus.replace('_', ' ').replace(/ \w/g, l => l.toUpperCase())}`,
        description: `Blog post "${postToUpdate.title}" has been updated.`,
      });
    } catch (err) {
      console.error("Error updating blog post status:", err);
      setBlogSubmissions(originalPosts); // Revert UI on error
      toast({
        title: "Update Failed",
        description: "Could not update blog post status.",
        variant: "destructive"
      });
    }
  };
  
  const handleDeletePost = async (postId: string) => {
    const originalPosts = [...blogSubmissions];
    const postToDelete = blogSubmissions.find(p => p.id === postId);
    if (!postToDelete) return;

    setBlogSubmissions(prev => prev.filter(post => post.id !== postId));

    try {
      await deleteFirestoreBlogPost(postId);
      toast({
        title: "Blog Post Deleted",
        description: `Blog post "${postToDelete.title}" has been successfully deleted.`,
      });
    } catch (err) {
      console.error("Error deleting blog post:", err);
      setBlogSubmissions(originalPosts); // Revert UI on error
      toast({
        title: "Deletion Failed",
        description: "Could not delete the blog post.",
        variant: "destructive"
      });
    }
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Loading blog submissions...</div>;
  }
  
  if (error) {
    return (
      <Card className="text-center py-12 bg-destructive/10 border-destructive">
        <CardHeader>
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3" />
          <CardTitle className="text-destructive">Error Loading Data</CardTitle>
          <CardDescription className="text-destructive/80">{error}</CardDescription>
        </CardHeader>
        <CardContent>
           <Button onClick={fetchPosts} variant="outline">Try Again</Button>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <FileText className="mr-3 h-7 w-7 text-primary" /> Manage Blog Submissions
        </CardTitle>
        <CardDescription>Review, approve, reject, or delete blog posts submitted by coaches.</CardDescription>
      </CardHeader>
      <CardContent>
        {blogSubmissions.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No blog submissions found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Title</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Submitted On</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blogSubmissions.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium max-w-xs truncate">
                    <Link
                      href={post.status === 'published' ? `/blog/${post.slug}` : `/dashboard/admin/blogs/preview/${post.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                        {post.title}
                    </Link>
                  </TableCell>
                  <TableCell>{post.authorName}</TableCell>
                  <TableCell>{format(new Date(post.createdAt), 'PP')}</TableCell>
                  <TableCell>
                    <Badge 
                      variant={post.status === 'published' ? 'default' : post.status === 'pending_approval' ? 'secondary' : (post.status === 'draft' ? 'outline' : 'destructive')}
                    >
                      {post.status.replace('_', ' ').replace(/ \w/g, l => l.toUpperCase())}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" asChild title="Preview Post">
                      <Link
                        href={post.status === 'published' ? `/blog/${post.slug}` : `/dashboard/admin/blogs/preview/${post.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    {post.status === 'pending_approval' || post.status === 'rejected' || post.status === 'draft' ? (
                      <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-100" onClick={() => handleStatusUpdate(post.id, 'published')} title="Approve and Publish">
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                    {post.status === 'pending_approval' || post.status === 'published' || post.status === 'draft' ? (
                      <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700 hover:bg-orange-100" onClick={() => handleStatusUpdate(post.id, 'rejected')} title="Reject Post">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    ) : null}
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/90 hover:bg-destructive/10" title="Delete Post">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the blog post
                              "{post.title}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeletePost(post.id)} className="bg-destructive hover:bg-destructive/90">
                              Yes, delete post
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

