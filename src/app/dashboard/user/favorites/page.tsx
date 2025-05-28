"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { getFavoriteCoaches } from '@/lib/firestore';
import type { Coach } from '@/types';
import { CoachCard } from '@/components/CoachCard';
import { Loader2, Heart, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

export default function FavoriteCoachesPage() {
  const { user, loading: authLoading } = useAuth(); // Added authLoading
  const [favoriteCoaches, setFavoriteCoaches] = useState<Coach[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true); // Keep loading if auth state is still loading
      return;
    }
    if (!user) {
      setIsLoading(false);
      setError("Please log in to see your favorite coaches.");
      setFavoriteCoaches([]); // Clear coaches if user logs out
      return;
    }

    const fetchFavorites = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const coaches = await getFavoriteCoaches(user.id);
        setFavoriteCoaches(coaches);
      } catch (err) {
        console.error("Error fetching favorite coaches:", err);
        setError("Could not load your favorite coaches. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavorites();
  }, [user, authLoading]); // Depend on user and authLoading

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Loading your favorite coaches...</p>
      </div>
    );
  }

  // Content will be rendered here
  return (
    <div className="container mx-auto py-8 px-4">
      <CardHeader className="px-0 mb-6">
        <CardTitle className="text-3xl font-bold tracking-tight flex items-center">
          <Heart className="mr-3 h-8 w-8 text-primary" />
          My Favorite Coaches
        </CardTitle>
        <CardDescription className="mt-2 text-lg">
          Here are the coaches you've saved. You can view their profiles or message them directly.
        </CardDescription>
      </CardHeader>

      {error && (
        <Card className="mb-6 bg-destructive/10 border-destructive text-destructive-foreground">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="mr-2 h-5 w-5" /> Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            {!user && (
                 <Button asChild variant="link" className="mt-2 px-0 text-destructive-foreground hover:text-destructive-foreground/80">
                    <Link href="/login">Go to Login</Link>
                </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!error && favoriteCoaches.length === 0 && (
        <Card className="text-center py-12">
           <CardHeader>
            <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <CardTitle>No Favorites Yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">
              You haven't added any coaches to your favorites. Start browsing and save the ones you like!
            </p>
            <Button asChild>
              <Link href="/browse-coaches">Browse Coaches</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && favoriteCoaches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favoriteCoaches.map((coach) => (
            <CoachCard key={coach.id} coach={coach} />
          ))}
        </div>
      )}
    </div>
  );
}
