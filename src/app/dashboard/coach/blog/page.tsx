
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BlogPostCard } from "@/components/BlogPostCard";
import { PlusCircle, FileText, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { BlogPost } from "@/types";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyBlogPosts } from "@/lib/firestore"; // Import Firestore function

export default function CoachBlogManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const [coachPosts, setCoachPosts] = useState<BlogPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role === 'coach' && user.id) {
      setIsLoadingPosts(true);
      setError(null);
      getMyBlogPosts(user.id)
        .then(posts => {
          setCoachPosts(posts);
        })
        .catch(err => {
          console.error("Error fetching coach blog posts:", err);
          setError("Failed to load your blog posts. Please try again later.");
        })
        .finally(() => {
          setIsLoadingPosts(false);
        });
    } else if (!authLoading && (!user || user.role !== 'coach')) {
        setIsLoadingPosts(false);
        setError("You must be logged in as a coach to manage blog posts.");
    }
  }, [user, authLoading]);

  if (authLoading || isLoadingPosts) {
    return (
      <div className="flex justify-center items-center h-full min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading your blog posts...</span>
      </div>
    );
  }

  if (error) {
     return (
        <Card className="text-center py-12 bg-destructive/10 border-destructive">
          <CardHeader>
            <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-3" />
            <CardTitle className="text-destructive">Error Loading Posts</CardTitle>
            <CardDescription className="text-destructive/80">{error}</CardDescription>
          </CardHeader>
          <CardContent>
             <Button asChild variant="outline">
                <Link href="/dashboard/coach">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
     )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <FileText className="mr-3 h-8 w-8 text-primary" />
            My Blog Posts
          </h1>
          <p className="text-muted-foreground">Manage your articles, drafts, and published content.</p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/dashboard/coach/blog/create">
            <PlusCircle className="mr-2 h-5 w-5" /> Create New Post
          </Link>
        </Button>
      </div>

      {coachPosts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {coachPosts.map((post) => (
            <BlogPostCard key={post.id} post={post} showEditButton={true} />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardHeader>
            <CardTitle>No Blog Posts Yet</CardTitle>
            <CardDescription>Start sharing your expertise by creating your first blog post.</CardDescription>
          </CardHeader>
          <CardContent>
             <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                <Link href="/dashboard/coach/blog/create">
                    <PlusCircle className="mr-2 h-5 w-5" /> Create Your First Post
                </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
