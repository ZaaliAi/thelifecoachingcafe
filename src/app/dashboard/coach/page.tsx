"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, MessageSquare, UserCircle, PlusCircle, BarChart3, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
// Assuming these functions exist or will be created in your firestore.ts:
import { getCoachBlogStats, getCoachUnreadMessageCount } from "@/lib/firestore"; 

export default function CoachDashboardPage() {
  const { user, loading } = useAuth();
  const [coachName, setCoachName] = useState("Coach");
  const [blogStats, setBlogStats] = useState<{ pending: number, published: number }>({ pending: 0, published: 0 });
  const [newMessages, setNewMessages] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    if (user && user.role === 'coach') {
      setCoachName(user.name || user.email?.split('@')[0] || "Coach");
      
      const fetchStats = async () => {
        setIsLoadingStats(true);
        if (user.id) {
          try {
            // Use Promise.all to fetch stats concurrently
            const [fetchedBlogStats, fetchedUnreadMessages] = await Promise.all([
              getCoachBlogStats ? getCoachBlogStats(user.id) : Promise.resolve({ pending: 0, published: 0 }), // Conditional call
              getCoachUnreadMessageCount(user.id)
            ]);
            
            if (getCoachBlogStats) { // Only set if the function was called
                setBlogStats(fetchedBlogStats || { pending: 0, published: 0 });
            } else {
                setBlogStats({ pending: 0, published: 0 }); // Default if getCoachBlogStats is not available
            }
            setNewMessages(fetchedUnreadMessages || 0);

          } catch (error) {
            console.error("Error fetching coach dashboard stats:", error);
            // Set to default values on error
            setBlogStats({ pending: 0, published: 0 });
            setNewMessages(0);
          }
        }
        setIsLoadingStats(false);
      };
      fetchStats();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.role !== 'coach') {
    return <p>Access denied. This dashboard is for coaches.</p>;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Welcome, {coachName}!</CardTitle>
          <CardDescription>Manage your profile, blog posts, and client interactions.</CardDescription>
        </CardHeader>
      </Card>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Profile</CardTitle>
            <UserCircle className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Edit & View</div>
            <p className="text-xs text-muted-foreground">Keep your profile engaging and up to date.</p>
            <Button asChild className="mt-4 w-full bg-green-500 hover:bg-green-700 text-white">
              <Link href="/dashboard/coach/profile">Manage Profile</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blog Posts</CardTitle>
            <FileText className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : <div className="text-2xl font-bold">{blogStats.pending} Pending/Drafts</div>}
            <p className="text-xs text-muted-foreground">{isLoadingStats ? "Loading..." : `${blogStats.published} Published.`} Share your expertise.</p>
             <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button asChild className="flex-1 bg-orange-500 hover:bg-orange-700 text-white">
                    <Link href="/dashboard/coach/blog">Manage Posts</Link>
                </Button>
                <Button asChild className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Link href="/dashboard/coach/blog/create">
                      <span><PlusCircle className="mr-2 h-4 w-4"/>New Post</span>
                    </Link>
                </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Client Messages</CardTitle>
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : <div className="text-2xl font-bold">{newMessages} New Messages</div> }
            <p className="text-xs text-muted-foreground">Respond to client inquiries</p>
            <Button asChild className="mt-4 w-full bg-blue-500 hover:bg-blue-700 text-white">
              <Link href="/dashboard/coach/messages">View Messages</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5 text-primary"/>Performance Overview</CardTitle>
            <CardDescription>Summary of your profile views and engagement.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Profile views, message rates, and blog engagement statistics will appear here (feature coming soon).</p>
        </CardContent>
      </Card>
    </div>
  );
}
