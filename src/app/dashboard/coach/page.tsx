"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, MessageSquare, UserCircle, PlusCircle, BarChart3, Loader2, Star, ExternalLink } from "lucide-react";
import { useAuth, type User } from "@/lib/auth";
import { useEffect, useState } from "react";
import { getCoachBlogStats, getCoachUnreadMessageCount } from "@/lib/firestore";
import { navItems } from '../../../config/navConfig'; // Updated path
import type { NavItem } from '../../../config/navConfig'; // Updated path
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils"; // Added cn
import { getFunctions, httpsCallable } from 'firebase/functions';
import { loadStripe } from '@stripe/stripe-js';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";

// It's good practice to ensure the User type from useAuth includes subscriptionTier
// If not, you might need to define an extended type here or update the one in @/lib/auth
interface AppUser extends User {
  subscriptionTier?: string; // free or premium
}

// ... rest of your file will follow after this import section
export default function CoachDashboardPage() {
  const { user: authUser, loading, logout } = useAuth(); // Added logout
  const user = authUser as AppUser | null; // Cast to AppUser
  const { toast } = useToast();
  const [coachName, setCoachName] = useState("Coach");
  const [blogStats, setBlogStats] = useState<{ pending: number, published: number }>({ pending: 0, published: 0 });
  const [newMessages, setNewMessages] = useState(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Removed useEffect for refreshUserProfile

  useEffect(() => {
    if (user && user.role === 'coach') {
      setCoachName(user.name || (user.email ? user.email.split('@')[0] : "Coach") || "Coach");
      
      const fetchStats = async () => {
        setIsLoadingStats(true);
        if (user.id) {
          try {
            const [fetchedBlogStats, fetchedUnreadMessages] = await Promise.all([
              getCoachBlogStats ? getCoachBlogStats(user.id) : Promise.resolve({ pending: 0, published: 0 }),
              getCoachUnreadMessageCount ? getCoachUnreadMessageCount(user.id) : Promise.resolve(0)
            ]);
            
            setBlogStats(fetchedBlogStats || { pending: 0, published: 0 });
            setNewMessages(fetchedUnreadMessages || 0);

          } catch (error) {
            console.error("Error fetching coach dashboard stats:", error);
            setBlogStats({ pending: 0, published: 0 });
            setNewMessages(0);
            toast({ title: "Error", description: "Could not load dashboard stats.", variant: "destructive" });
          }
        }
        setIsLoadingStats(false);
      };
      fetchStats();
    }
  }, [user, toast]);

  const handleUpgrade = async () => {
    if (!user || !user.id) {
      console.error("User not authenticated for upgrade.");
      toast({ title: "Authentication Error", description: "Please log in again to upgrade.", variant: "destructive" });
      return;
    }
    const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!stripePublishableKey) {
        console.error("Stripe publishable key is not set in environment variables.");
        toast({ title: "Configuration Error", description: "Stripe payments are not configured correctly. Please contact support.", variant: "destructive" });
        setIsUpgrading(false);
        return;
    }
    setIsUpgrading(true);
    try {
      const functions = getFunctions(firebaseApp);
      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSessionCallable');

      const successUrl = `${window.location.origin}/payment-success?upgrade=true&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${window.location.origin}/dashboard/coach`;

      const result: any = await createCheckoutSession({
        priceId: "price_1RURVlG6UVJU45QN1mByj8Fc", // Premium Price ID
        successUrl: successUrl,
        cancelUrl: cancelUrl,
        userId: user.id,
      });

      if (result.data.sessionId) {
        const stripe = await loadStripe(stripePublishableKey);
        if (stripe) {
          const { error: stripeError } = await stripe.redirectToCheckout({ sessionId: result.data.sessionId });
          if (stripeError) {
            console.error("Stripe redirect error:", stripeError);
            toast({ title: "Payment Error", description: stripeError.message || "Could not redirect to Stripe. Please try again.", variant: "destructive" });
          }
        } else {
          console.error("Stripe.js failed to load.");
          toast({ title: "Payment Error", description: "Stripe.js failed to load. Please try again.", variant: "destructive" });
        }
      } else {
        const errorMessage = result.data.error || "Failed to create Stripe session. Please try again.";
        console.error("Failed to create Stripe session:", errorMessage);
        toast({ title: "Upgrade Error", description: errorMessage, variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Error calling createCheckoutSessionCallable:", error);
      toast({ title: "Upgrade Error", description: error.message || "An unexpected error occurred. Please try again.", variant: "destructive" });
    }
    setIsUpgrading(false);
  };

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
  
  const isPremiumCoach = user.subscriptionTier === 'premium'; 


  const isPremiumCoach = user?.subscriptionTier === 'premium';

  // Filter navItems for coach role
  const accessibleNavItems = user ? navItems.filter(item =>
    item.roles.includes('coach') &&
    (!item.requiresPremium || isPremiumCoach)
  ) : [];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Welcome, {coachName}!</CardTitle>
          <CardDescription>Manage your profile, blog posts, and client interactions. {isPremiumCoach && <span className="font-semibold text-primary">(Premium Coach <Star className="inline h-5 w-5 text-yellow-400 fill-yellow-400" />)</span>}</CardDescription>
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

      {/* Main Dashboard Function Cards (Existing cards) */}
      <h2 className="text-2xl font-semibold tracking-tight">Quick Actions & Overview</h2>
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

      {/* Upgrade to Premium Card - Moved to after the main function cards */}
      {!isPremiumCoach && user.role === 'coach' && (
        <Card className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle className="text-2xl">Unlock Premium Features!</CardTitle>
                    <CardDescription className="text-indigo-100">Elevate your coaching practice with exclusive benefits.</CardDescription>
                </div>
                <Star className="h-12 w-12 text-yellow-300" />
            </div>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 mb-6 text-indigo-50">
              <li>Add a Profile Picture to build trust</li>
              <li>Get a Premium Badge on your profile and cards</li>
              <li>Link to your personal website to drive traffic</li>
              <li>Embed an introductory video to engage visitors</li>
              <li>Display your social media links to grow your brand</li>
            </ul>
            <Button 
              onClick={handleUpgrade} 
              disabled={isUpgrading} 
              size="lg" 
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-purple-700 font-bold shadow-md transition-transform transform hover:scale-105"
            >
              {isUpgrading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Upgrading...</>
              ) : (
                <>Upgrade to Premium Now <ExternalLink className="ml-2 h-5 w-5" /></>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Performance Overview Card - Stays after the (potentially moved) Upgrade card */}
      {/* Removed Performance Overview Card */}
    </div>
  );
}
