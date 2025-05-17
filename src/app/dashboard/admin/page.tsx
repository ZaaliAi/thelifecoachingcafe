
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, FileText, MessageSquare, BarChart3, ShieldAlert } from "lucide-react";

export default function AdminDashboardPage() {
  // In a real app, fetch admin-specific stats
  const pendingCoaches = 5; // Placeholder
  const pendingBlogPosts = 12; // Placeholder
  const totalUsers = 150; // Placeholder
  const totalCoaches = 25; // Placeholder

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
            <div className="text-2xl font-bold">{pendingCoaches} Pending</div>
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
            <div className="text-2xl font-bold">{pendingBlogPosts} Pending</div>
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
            <div className="text-lg font-bold">{totalUsers} Users</div>
            <div className="text-lg font-bold">{totalCoaches} Coaches</div>
            <p className="text-xs text-muted-foreground mt-1">Overall platform engagement.</p>
            {/* More stats can go here */}
          </CardContent>
        </Card>
      </div>
      
      {/* Placeholder for other admin tools */}
      <Card>
        <CardHeader>
            <CardTitle>Quick Actions & Tools</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <p className="text-muted-foreground">Additional administrative functions and platform settings will be accessible here.</p>
            <Button variant="destructive" disabled>Suspend User (Example)</Button>
            <Button variant="outline" disabled className="ml-2">Site Configuration (Example)</Button>
        </CardContent>
      </Card>
    </div>
  );
}
