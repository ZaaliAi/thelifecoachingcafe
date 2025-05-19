"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, FileText, MessageSquare, BarChart3, ShieldAlert, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { 
  getPendingCoachCount, 
  // getPendingBlogPostCount, 
  getTotalUserCount, 
  getTotalCoachCount 
} from "@/lib/firestore";

export default function AdminDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    pendingCoaches: 0,
    // pendingBlogPosts: 0, 
    totalUsers: 0,
    totalCoaches: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    if (user && user.role === 'admin') {
      const fetchStats = async () => {
        setIsLoadingStats(true);
        const [
          pendingCoachesCount,
          // pendingBlogPostsCount,
          totalUsersCount,
          totalCoachesCount
        ] = await Promise.all([
          getPendingCoachCount(),
          // getPendingBlogPostCount(), 
          getTotalUserCount(),
          getTotalCoachCount()
        ]);
        setStats({
          pendingCoaches: pendingCoachesCount,
          // pendingBlogPosts: pendingBlogPostsCount, 
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coach Registrations</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingStats ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">{stats.pendingCoaches} Pending</div>}
            <p className="text-xs text-muted-foreground">Review and approve new coach applications.</p>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/dashboard/admin/coaches">Manage Coaches</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blog Submissions</CardTitle>
            <FileText className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoadingStats ? <Loader2 className="h-6 w-6 animate-spin"/> : <div className="text-2xl font-bold">0 Pending</div>} {/* Placeholder */}
            <p className="text-xs text-muted-foreground">Review and publish coach blog posts.</p>
            <Button asChild variant="outline" className="mt-4 w-full">
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
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/dashboard/admin/messages">Access Logs</Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Stats</CardTitle>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoadingStats ? <Loader2 className="h-6 w-6 animate-spin"/> : 
             <>
                <div className="text-lg font-bold">{stats.totalUsers} Total Users</div>
                <div className="text-lg font-bold">{stats.totalCoaches} Total Coaches</div>
             </>
             }
            <p className="text-xs text-muted-foreground mt-1">Overall platform engagement.</p>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Quick Actions & Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <p className="text-muted-foreground">Additional administrative functions and platform settings will be accessible here.</p>
            <Button variant="destructive" disabled>Suspend User (Example)</Button>
            <Button asChild variant="outline" className="ml-2">
                <Link href="/dashboard/admin/settings">Site Configuration</Link>
            </Button>
        </CardContent>
      </Card>
    </div>
  );
}
