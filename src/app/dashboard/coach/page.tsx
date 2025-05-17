
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, MessageSquare, UserCircle, PlusCircle, BarChart3 } from "lucide-react";

export default function CoachDashboardPage() {
  // In a real app, fetch coach-specific data here
  const coachName = "Coach Example"; // Placeholder
  const pendingBlogPosts = 1; // Placeholder
  const newMessages = 5; // Placeholder

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
            <Button asChild variant="outline" className="mt-4 w-full">
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
            <div className="text-2xl font-bold">{pendingBlogPosts} Pending Approval</div>
            <p className="text-xs text-muted-foreground">Share your expertise and insights.</p>
             <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button asChild variant="outline" className="flex-1">
                    <Link href="/dashboard/coach/blog">Manage Posts</Link>
                </Button>
                <Button asChild className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Link href="/dashboard/coach/blog/create"><PlusCircle className="mr-2 h-4 w-4"/>New Post</Link>
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
            <div className="text-2xl font-bold">{newMessages} New Messages</div>
            <p className="text-xs text-muted-foreground">Respond to inquiries and connect with clients.</p>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/dashboard/coach/messages">View Messages</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      
      {/* Placeholder for stats or other quick actions */}
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5 text-primary"/>Performance Overview</CardTitle>
            <CardDescription>Summary of your profile views and engagement.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Profile views, message rates, and blog engagement statistics will appear here.</p>
          {/* Example stats
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-sm text-muted-foreground">Profile Views (Last 30d)</p>
              <p className="text-2xl font-semibold">1,234</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Messages Received (Last 30d)</p>
              <p className="text-2xl font-semibold">56</p>
            </div>
          </div>
          */}
        </CardContent>
      </Card>
    </div>
  );
}
