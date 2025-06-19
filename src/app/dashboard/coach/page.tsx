"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, MessageSquare, UserCircle, PlusCircle, BarChart3, Loader2, Star, ExternalLink, Settings, CreditCard, MessageSquareText } from "lucide-react";
import { useAuth, type User } from "@/lib/auth"; // Assuming User type can be imported from auth
import { useEffect, useState } from "react";
import { getCoachBlogStats, getCoachUnreadMessageCount } from "@/lib/firestore";
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
  const { user: authUser, loading } = useAuth(); // Removed refreshUserProfile
  const user = authUser as AppUser | null; // Cast to AppUser
  const { toast } = useToast();
  // const hasRefreshedInitially = useRef(false); // Removed ref
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
        priceId: "price_1RbHz1G028VJJAft7M0DUoUF", // Premium Price ID
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

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Welcome, {coachName}!</CardTitle>
          <CardDescription>Manage your profile, blog posts, and client interactions. {isPremiumCoach && <span className="font-semibold text-primary">(Premium Coach <Star className="inline h-5 w-5 text-yellow-400 fill-yellow-400" />)</span>}</CardDescription>
        </CardHeader>
      </Card>

      {/* Main Dashboard Function Cards */}
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
        
        {isPremiumCoach && (
            <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">My Testimonials</CardTitle>
                    <MessageSquareText className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">Manage Testimonials</div>
                    <p className="text-xs text-muted-foreground">Share client feedback.</p>
                    <Button asChild className="mt-4 w-full bg-teal-500 hover:bg-teal-700 text-white">
                        <Link href="/dashboard/coach/testimonials">View Testimonials</Link>
                    </Button>
                </CardContent>
            </Card>
        )}

        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Billing</CardTitle>
                <CreditCard className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">Manage Subscription</div>
                <p className="text-xs text-muted-foreground">View your billing history and subscription.</p>
                <Button asChild className="mt-4 w-full bg-indigo-500 hover:bg-indigo-700 text-white">
                    <Link href="/dashboard/coach/billing">Billing Details</Link>
                </Button>
            </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Settings</CardTitle>
                <Settings className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">Account Settings</div>
                <p className="text-xs text-muted-foreground">Update your account preferences.</p>
                <Button asChild className="mt-4 w-full bg-gray-500 hover:bg-gray-700 text-white">
                    <Link href="/dashboard/coach/settings">Update Settings</Link>
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
