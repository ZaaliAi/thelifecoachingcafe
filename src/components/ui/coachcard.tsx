"use client"; // Added this directive

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import type { Coach, FirestoreUserProfile } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Briefcase, MapPin, MessageSquare, Crown, Heart, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/lib/auth';
import { addCoachToFavorites, removeCoachFromFavorites, getUserProfile } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';

interface CoachCardProps {
  coach: Coach;
}

export function CoachCard({ coach }: CoachCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoadingFavorite, setIsLoadingFavorite] = useState(false);
  const [checkingFavoriteStatus, setCheckingFavoriteStatus] = useState(true);

  const fetchFavoriteStatus = useCallback(async () => {
    if (user && user.id && coach && coach.id) {
      setCheckingFavoriteStatus(true);
      try {
        const userProfile = await getUserProfile(user.id);
        if (userProfile && userProfile.favoriteCoachIds?.includes(coach.id)) {
          setIsFavorited(true);
        } else {
          setIsFavorited(false);
        }
      } catch (error) {
        console.error("Error fetching favorite status:", error);
      } finally {
        setCheckingFavoriteStatus(false);
      }
    } else {
      setIsFavorited(false);
      setCheckingFavoriteStatus(false);
    }
  }, [user, coach.id]);

  useEffect(() => {
    fetchFavoriteStatus();
  }, [fetchFavoriteStatus]);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user || !user.id) {
      toast({
        title: "Login Required",
        description: "Please log in to favorite a coach.",
        variant: "destructive",
      });
      return;
    }
    if (!coach || !coach.id) return;

    // Add these console.logs:
    console.log("Authenticated user object:", user);
    console.log("Authenticated user ID:", user?.id);
    console.log("Coach ID (value and type):", coach?.id, typeof coach?.id);
    console.log("User ID passed to Firestore function:", user?.id); // Assuming user.id is passed as the userId


    setIsLoadingFavorite(true);
    try {
      if (isFavorited) {
        await removeCoachFromFavorites(user.id, coach.id);
        setIsFavorited(false);
        toast({ title: "Unfavorited", description: `${coach.name} removed from your favorites.` });
      } else {
        await addCoachToFavorites(user.id, coach.id);
        setIsFavorited(true);
        toast({ title: "Favorited!\", description: `${coach.name} added to your favorites.` });
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast({ title: "Error", description: "Could not update favorites. Please try again.\", variant: \"destructive" });
    } finally {
      setIsLoadingFavorite(false);
    }
  };

  if (!coach || !coach.name) {
    return null;
  }

  const initials = coach.name
    ? coach.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'CC';

  return (
    <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 h-full">
      <CardHeader className="relative flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 p-6">
        {user && (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 text-muted-foreground hover:text-primary disabled:opacity-50"
                        onClick={handleToggleFavorite}
                        disabled={isLoadingFavorite || checkingFavoriteStatus}
                        aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                    >
                        {isLoadingFavorite || checkingFavoriteStatus ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <Heart className={`h-5 w-5 ${isFavorited ? 'fill-red-500 text-red-500' : 'fill-none'}`} />
                        )}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{isFavorited ? 'Remove from favorites' : 'Add to favorites'}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
        )}
        {coach.profileImageUrl && (
          <Avatar className="h-24 w-24 sm:h-20 sm:w-20 flex-shrink-0">
            <AvatarImage
              src={coach.profileImageUrl}
              alt={coach.name}
              data-ai-hint={(coach.dataAiHint as string) || 'person portrait'}
            />
            <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
          </Avatar>
        )}
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <CardTitle className="text-xl font-semibold">{coach.name}</CardTitle>
            {coach.subscriptionTier === 'premium' && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="ml-2 bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-500 text-primary-foreground border-yellow-500">
                      <Crown className="h-4 w-4 mr-1" />
                      Premium
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This coach has a Premium subscription.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {coach.location && (
            <p className="text-sm text-muted-foreground flex items-center justify-center sm:justify-start mt-1">
              <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
              {coach.location}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-0 flex-grow">
        <p className="text-sm text-muted-foreground line-clamp-4 mb-4">{coach.bio}</p>
        <div className="mb-2">
          <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2 flex items-center">
            <Briefcase className="h-4 w-4 mr-1.5 flex-shrink-0" />
            Specialties
          </h4>
          <div className="flex flex-wrap gap-2">
            {coach.specialties?.slice(0, 3).map((specialty) => (
              <Badge key={specialty} variant="default" className="text-xs">
                {specialty}
              </Badge>
            ))}
            {coach.specialties && coach.specialties.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{coach.specialties.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-6 border-t mt-auto">
        <div className="flex gap-2 w-full">
          <Button asChild variant="outline" className="flex-1">
            <Link href={`/coach/${coach.id}`}>View Profile</Link>
          </Button>
          <Button asChild className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href={`/messages/new?coachId=${coach.id}`}>
              <>
                <MessageSquare className="mr-2 h-4 w-4" /> Message
              </>
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}