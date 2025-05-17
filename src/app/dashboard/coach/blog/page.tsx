
"use client"; // This page involves user-specific data and actions

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BlogPostCard } from "@/components/BlogPostCard";
import { mockBlogPosts } from "@/data/mock"; // Assuming current coach's ID is '1' for mock data
import { PlusCircle, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth"; // To get current coach ID
import type { BlogPost } from "@/types";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CoachBlogManagementPage() {
  const { user } = useAuth();
  const [coachPosts, setCoachPosts] = useState<BlogPost[]>([]);

  useEffect(() => {
    if (user && user.role === 'coach') {
      // In a real app, fetch posts by user.id
      // For mock, filter by authorId if user.id matches mock coach id structure
      // Let's assume mock coach has id '1' (Dr. Eleanor Vance)
      const currentCoachId = "1"; // Replace with dynamic user.id in real app.
      setCoachPosts(mockBlogPosts.filter(post => post.authorId === currentCoachId));
    }
  }, [user]);

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
