"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, FileText, MessageSquare, BarChart3, ShieldAlert, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { 
  getPendingBlogPostCount, 
  getTotalUserCount, 
  getTotalCoachCount 
} from "@/lib/firestore";
import { navItems } from '../../../config/navConfig'; // Updated path
import type { NavItem } from '../../../config/navConfig'; // Updated path
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminDashboardPage() {
  const { user, loading: authLoading, logout } = useAuth(); // Added logout
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


  // Filter navItems for admin role
  const accessibleNavItems = user ? navItems.filter(item =>
    item.roles.includes('admin')
    // && (!item.requiresPremium || user.subscriptionTier === 'premium') // Assuming admins don't have tiers
  ) : [];

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

      {/* === New Navigation Cards Grid === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {accessibleNavItems.map((item) => (
          <Link href={item.href} key={item.href} passHref legacyBehavior>
            <a className="block hover:no-underline focus:outline-none focus:ring-2 focus:ring-primary rounded-lg">
              <Card className="h-full hover:shadow-md transition-shadow duration-150 ease-in-out flex flex-col items-center justify-center p-6 text-center">
                <item.icon className="h-10 w-10 mb-3 text-primary" />
                <CardTitle className="text-lg font-semibold">{item.label}</CardTitle>
              </Card>
            </a>
          </Link>
        ))}
        {/* Logout Card */}
        {user && (
           <div
             onClick={logout}
             className="block hover:no-underline focus:outline-none focus:ring-2 focus:ring-destructive rounded-lg cursor-pointer"
             tabIndex={0} // Make it focusable
             onKeyPress={(e) => e.key === 'Enter' && logout()} // Keyboard accessible
           >
            <Card className="h-full hover:shadow-md transition-shadow duration-150 ease-in-out flex flex-col items-center justify-center p-6 text-center text-destructive border-destructive/50 hover:bg-destructive/5">
              <LogOut className="h-10 w-10 mb-3" />
              <CardTitle className="text-lg font-semibold">Logout</CardTitle>
            </Card>
          </div>
        )}
      </div>
      {/* === End of New Navigation Cards Grid === */}

      {/* Existing Stats/Management Cards */}
      <h2 className="text-2xl font-semibold tracking-tight">Platform Overview & Management</h2>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
