"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MessageSquare, UserCircle, Search, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { getMessagesForUserOrCoach } from "@/lib/messageService"; // Import the message service function

export default function UserDashboardPage() {
  const { user, loading } = useAuth();
  const [userName, setUserName] = useState("Valued User");
  const [unreadMessageCount, setUnreadMessageCount] = useState(0); // Renamed for clarity
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  useEffect(() => {
    if (user) {
      setUserName(user.name || user.email?.split('@')[0] || "User");

      const fetchUnreadMessages = async () => {
        setIsLoadingMessages(true);
        try {
          // Fetch all messages for the user (sent and received)
          const allMessages = await getMessagesForUserOrCoach(user.id);
          
          // Calculate the number of unread messages where the current user is the recipient
          const unreadCount = allMessages.filter(
            (msg) => msg.recipientId === user.id && !msg.read
          ).length;
          
          setUnreadMessageCount(unreadCount);
        } catch (error) {
          console.error("Failed to fetch unread messages for dashboard:", error);
          setUnreadMessageCount(0); // Set to 0 on error
        } finally {
          setIsLoadingMessages(false);
        }
      };

      fetchUnreadMessages();
    }
  }, [user]); // Rerun effect when user changes

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!user) {
    // This should ideally be handled by the DashboardLayout redirecting to /login
    return <p>Please log in to view your dashboard.</p>;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Welcome, {userName}!</CardTitle>
          <CardDescription>This is your personal dashboard. Manage your interactions and find your ideal coach.</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">My Profile</CardTitle>
            <UserCircle className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">View & Edit</div>
            <p className="text-xs text-muted-foreground">Keep your information up to date and update your profile.</p>
            <Button asChild className="mt-4 w-full bg-orange-500 text-white hover:bg-orange-600">
              <Link href="/dashboard/user/settings">Go to Profile</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Messages Card */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingMessages ? (
              <div className="text-xl font-bold flex items-center">
                 <Loader2 className="mr-2 h-5 w-5 animate-spin text-muted-foreground" /> Loading...
              </div>
            ) : (
              <div className="text-2xl font-bold">{unreadMessageCount} New Messages</div>
            )}
            <p className="text-xs text-muted-foreground">Connect with coaches and review your conversations.</p>
            <Button asChild className="mt-4 w-full bg-green-500 text-white hover:bg-green-600">
              <Link href="/dashboard/user/messages">View Messages</Link>
            </Button>
          </CardContent>
        </Card>
        
        {/* Find a New Coach Card - Styling adjusted previously */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Find a New Coach</CardTitle>
            <Search className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Explore Coaches</div>
            <p className="text-xs text-muted-foreground">Use CoachMatch AI to find your perfect match.</p>
             <Button asChild className="mt-4 w-full">
              <Link href="/find-a-coach">Search Coaches</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Your recent searches and saved coaches will appear here (feature coming soon).</p>
        </CardContent>
      </Card>
    </div>
  );
}
