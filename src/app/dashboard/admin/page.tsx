"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, FileText, MessageSquare, ShieldAlert, Loader2, UserX, Settings, MessageSquareText } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { 
  getPendingBlogPostCount, 
  getTotalUserCount, 
  getTotalCoachCount 
} from "@/lib/firestore";

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    pendingBlogPosts: 0,
    totalUsers: 0,
    totalCoaches: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    if (user && user.role === 'admin') {
      const fetchStats = async () => {
        setIsLoadingStats(true);
        const [
          pendingBlogPostsCount,
          totalUsersCount,
          totalCoachesCount
        ] = await Promise.all([
          getPendingBlogPostCount(),
          getTotalUserCount(),
          getTotalCoachCount()
        ]);
        setStats({
          pendingBlogPosts: pendingBlogPostsCount,
          totalUsers: totalUsersCount,
          totalCoaches: totalCoachesCount,
        });
        setIsLoadingStats(false);
      };
      fetchStats();
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user || user.role !== 'admin') {
     return <p>Access Denied. This dashboard is for administrators only.</p>;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl flex items-center">
            <ShieldAlert className="mr-3 h-8 w-8 text-primary" />
            Administrator Dashboard
          </CardTitle>
          <CardDescription>Oversee platform activity, manage users, and approve content.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manage Coaches</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats 
              ? <Loader2 className="h-6 w-6 animate-spin"/> 
              : <div className="text-2xl font-bold">{stats.totalCoaches} Coaches</div>}
            <p className="text-xs text-muted-foreground">Manage coach profiles and subscriptions.</p>
            <Button asChild variant="default" className="mt-4 w-full">
              <Link href="/dashboard/admin/coaches">Manage Coaches</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manage Users</CardTitle>
            <UserX className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats 
              ? <Loader2 className="h-6 w-6 animate-spin"/> 
              : <div className="text-2xl font-bold">{stats.totalUsers} Users</div>}
            <p className="text-xs text-muted-foreground">Manage user accounts.</p>
            <Button asChild variant="default" className="mt-4 w-full">
              <Link href="/dashboard/admin/users">Manage Users</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blog Submissions</CardTitle>
            <FileText className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoadingStats 
               ? <Loader2 className="h-6 w-6 animate-spin"/> 
               : <div className="text-2xl font-bold">{stats.pendingBlogPosts} Pending</div>}
            <p className="text-xs text-muted-foreground">Review and publish coach blog posts.</p>
            <Button 
              asChild 
              className="mt-4 w-full bg-orange-500 text-white hover:bg-orange-600 focus-visible:ring-orange-400"
            >
              <Link href="/dashboard/admin/blogs">Manage Blogs</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Message Logs</CardTitle>
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">View Activity</div>
            <p className="text-xs text-muted-foreground">Monitor messaging for moderation purposes.</p>
            <Button 
              asChild 
              className="mt-4 w-full bg-primary text-white hover:bg-primary/90 focus-visible:ring-primary"
            >
              <Link href="/dashboard/admin/messages">Access Logs</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manage Testimonials</CardTitle>
            <MessageSquareText className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Manage Testimonials</div>
            <p className="text-xs text-muted-foreground">Review and approve testimonials.</p>
            <Button asChild className="mt-4 w-full">
              <Link href="/dashboard/admin/testimonials">Manage Testimonials</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Settings</CardTitle>
            <Settings className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Site Configuration</div>
            <p className="text-xs text-muted-foreground">Manage platform-wide settings.</p>
            <Button asChild className="mt-4 w-full">
              <Link href="/dashboard/admin/settings">Platform Settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
