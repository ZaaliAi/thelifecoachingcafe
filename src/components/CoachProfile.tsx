"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Loader2, UserCircle, MapPin, Globe, Image as ImageIcon, Video, MessageSquare, Heart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import NextImage from "next/image";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import type { Coach } from "@/types";
import { useAuth } from '@/lib/auth';
import { addCoachToFavorites, removeCoachFromFavorites, getUserProfile } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Helper to get initials
const getInitials = (name: string): string => {
  if (!name) return "??";
  const names = name.split(' ');
  const firstNameInitial = names[0] ? names[0][0] : '';
  const lastNameInitial = names.length > 1 && names[names.length - 1] ? names[names.length - 1][0] : '';
  return `${firstNameInitial}${lastNameInitial}`.toUpperCase();
};

// LinkedIn SVG icon
function LinkedInIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4.98 3.5C3.34 3.5 2 4.84 2 6.48c0 1.63 1.34 2.97 2.98 2.97h.02c1.64 0 2.98-1.34 2.98-2.97C7.98 4.84 6.62 3.5 4.98 3.5zM2.4 21.5h5.15v-12H2.4v12zM9.55 9.5V21.5h5.14v-6.02c0-1.6.03-3.67 2.24-3.67 2.23 0 2.23 1.84 2.23 3.75v5.94H24v-6.37c0-4-2.13-5.87-4.98-5.87-2.3 0-3.32 1.28-3.89 2.18h.03V9.5h-5.61z"/>
    </svg>
  );
}

function SocialButton({ url, label, icon, className }: { url: string; label: string; icon: React.ReactNode; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 px-4 py-2 rounded font-medium transition shadow ${className || "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
    >
      {icon}
      <span>{label}</span>
    </a>
  );
}

interface CoachProfileClientProps {
  coachData: Coach | null;
  coachId: string; // coachId is passed from the server component
}

export default function CoachProfile({ coachData, coachId }: CoachProfileClientProps) {
  const [coach, setCoach] = useState<Coach | null>(coachData);
  const [loading, setLoading] = useState(!coachData);
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLoadingFavorite, setIsLoadingFavorite] = useState(false);
  const [checkingFavoriteStatus, setCheckingFavoriteStatus] = useState(true);

  // Use coachId directly as it's guaranteed to be the ID of the profile being viewed
  const fetchFavoriteStatus = useCallback(async () => {
    if (user && user.id && coachId) {
      setCheckingFavoriteStatus(true);
      try {
        const userProfile = await getUserProfile(user.id);
        if (userProfile && userProfile.favoriteCoachIds?.includes(coachId)) {
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
  }, [user, coachId]);

  useEffect(() => {
    fetchFavoriteStatus();
  }, [fetchFavoriteStatus]);

  const handleToggleFavorite = async () => {
    if (!user || !user.id) {
      toast({
        title: "Login Required",
        description: "Please log in to favorite a coach.",
        variant: "destructive",
      });
      return;
    }
    if (!coachId) {
         console.error("Coach ID is missing, cannot toggle favorite.");
         return; // Add a check and log if coachId is missing
    }


    // START of added console.log statements
    console.log("Authenticated user object:", user);
    console.log("Authenticated user ID:", user?.id);
    console.log("Coach object:", coach);
    console.log("Coach ID:", coachId); // Use coachId directly from props as it's guaranteed to be the ID
    console.log("Type of Coach ID:", typeof coachId); // Use coachId directly from props
    console.log("User ID passed to Firestore function:", user?.id);
    // END of added console.log statements


    setIsLoadingFavorite(true);
    try {
      const currentCoachName = coach?.name || "this coach"; // Fallback name for toast
      if (isFavorited) {
        await removeCoachFromFavorites(user.id, coachId);
        setIsFavorited(false);
        toast({ title: "Unfavorited", description: `${currentCoachName} removed from your favorites.` });
      } else {
        await addCoachToFavorites(user.id, coachId);
        setIsFavorited(true);
        toast({ title: "Favorited!", description: `${currentCoachName} added to your favorites.` });
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      toast({ title: "Error", description: "Could not update favorites. Please try again.", variant: "destructive" });
    } finally {
      setIsLoadingFavorite(false);
    }
  };

  useEffect(() => {
    if (coachData) {
      setCoach(coachData);
      setLoading(false);
    }
    // If coachData is not initially provided, you might want to fetch it using coachId
    // This depends on whether the server component always successfully provides coachData
  }, [coachData]);


  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[calc(100vh-200px)]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" /> Loading profile...
      </div>
    );
  }

  if (!coach) {
    return (
      <div className="flex justify-center items-center h-full min-h-[calc(100vh-200px)]">
        Profile not found.
      </div>
    );
  }

  const isPremium = coach.subscriptionTier === "premium";
  const socials = coach.socialLinks || [];
  const linkedIn = socials.find((s: any) => s.platform?.toLowerCase().includes("linkedin"));
  const otherSocials = socials.filter((s: any) => !s.platform?.toLowerCase().includes("linkedin"));

  const availabilityByDay: { [key: string]: string[] } = {};
  if (coach.availability && coach.availability.length > 0) {
    coach.availability.forEach((slot: { day: string, time: string }) => {
      if (!availabilityByDay[slot.day]) {
        availabilityByDay[slot.day] = [];
      }
      availabilityByDay[slot.day].push(slot.time);
    });
  }
  const orderedDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const sortedAvailabilityDays = Object.keys(availabilityByDay).sort((a, b) => orderedDays.indexOf(a) - orderedDays.indexOf(b));

  const coachInitials = getInitials(coach.name);

  return (
    <div className="min-h-screen bg-gray-50 pb-12 flex flex-col items-center">
      <div className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col items-center px-2 sm:px-6 pt-12 pb-8 mt-8 sm:mt-16">
        <div className="flex flex-col items-center w-full">
          <Dialog>
            <DialogTrigger asChild>
              <div className="relative w-32 h-32 cursor-pointer">
                {coach.profileImageUrl ? (
                  <div className="rounded-full shadow-lg border-4 border-primary overflow-hidden w-32 h-32 bg-white">
                    <NextImage
                      src={coach.profileImageUrl}
                      alt={coach.name}
                      width={128}
                      height={128}
                      className="object-cover w-32 h-32"
                      priority
                    />
                  </div>
                ) : (
                  <div
                    className="rounded-full shadow-lg border-4 border-primary bg-muted flex items-center justify-center w-32 h-32 text-primary select-none"
                    title={coach.name}
                  >
                    <span className="text-4xl font-semibold">{coachInitials}</span>
                  </div>
                )}
              </div>
            </DialogTrigger>
            <DialogContent className="!max-w-fit !w-auto !h-auto p-0">
               <DialogTitle className="sr-only">{`Profile image of ${coach.name}`}</DialogTitle>
               {coach.profileImageUrl ? (
                 <NextImage
                    src={coach.profileImageUrl}
                    alt={`Full size profile image of ${coach.name}`}
                    width={500}
                    height={500}
                    className="object-contain max-h-[calc(100vh-80px)] max-w-[calc(100vw-80px)]"
                 />
               ) : (
                  <div className="w-64 h-64 bg-muted flex items-center justify-center text-primary select-none">
                     <span className="text-7xl font-semibold">{coachInitials}</span>
                  </div>
                )}
            </DialogContent>
          </Dialog>

          <h1 className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2 text-center">{coach.name}</h1>
          <div className="text-base text-gray-500 font-medium flex flex-wrap items-center gap-2 mt-1">
            <UserCircle className="h-5 w-5" />
            {coach.role ? coach.role.charAt(0).toUpperCase() + coach.role.slice(1) : "Coach"}
            {coach.subscriptionTier && (
              <Badge
                className={`ml-2 px-3 py-1 rounded-full border-0`}
                style={isPremium ? {
                  background:
                    "linear-gradient(90deg,#FFD700 20%, #FFEA70 100%)",
                  color: "#7c6600",
                  fontWeight: 700,
                  letterSpacing: "1px"
                } : {}}
              >
                {coach.subscriptionTier.toUpperCase()}
              </Badge>
            )}
          </div>
          {coach.location && (
            <div className="mt-2 text-base text-gray-500 flex items-center gap-2">
              <MapPin className="h-5 w-5" /> {coach.location}
            </div>
          )}
          {/* Action Buttons Section including Favorite Button */}
          <div className="mt-5 mb-2 flex flex-wrap gap-3 justify-center items-center">
            {coachId && (
              <Button asChild className="flex items-center gap-2 px-6 py-2 rounded bg-green-600 text-white font-semibold hover:bg-green-700 transition shadow">
                <Link href={`/messages/new?coachId=${coachId}`}>
                  <>
                    <MessageSquare className="h-5 w-5" /> Message
                  </>
                </Link>
              </Button>
            )}
            {coach.introVideoUrl && (
              <SocialButton
                url={coach.introVideoUrl}
                label="Intro Video"
                icon={<Video className="h-5 w-5" />}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              />
            )}
            {/* Favorite Button */}
            {user && coachId && (
                 <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-primary disabled:opacity-50 p-2 h-auto rounded-md shadow hover:shadow-md"
                                onClick={handleToggleFavorite}
                                disabled={isLoadingFavorite || checkingFavoriteStatus}
                                aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                {isLoadingFavorite || checkingFavoriteStatus ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Heart className={`h-5 w-5 ${isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{isFavorited ? 'Unfavorite Coach' : 'Favorite Coach'}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
          </div>
        </div>

        <hr className="w-full border-t border-gray-200 my-6" />

        <div className="w-full">
          <h2 className="text-lg font-semibold mb-2">About</h2>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">{coach.bio}</p>
        </div>

        {(coach.specialties?.length || coach.keywords?.length || coach.certifications?.length) && (
          <hr className="w-full border-t border-gray-200 my-6" />
        )}

        <div className="w-full flex flex-col sm:flex-row flex-wrap gap-8">
          <div className="flex-1 min-w-[180px]">
            <h3 className="text-base font-semibold mb-2">Specialties</h3>
            <div className="flex flex-wrap gap-2">
              {(coach.specialties || []).map((s: string) => (
                <Badge key={s} className="bg-primary/10 border-primary text-primary">{s}</Badge>
              ))}
            </div>
          </div>
          {coach.keywords && coach.keywords.length > 0 && (
            <div className="flex-1 min-w-[180px]">
              <h3 className="text-base font-semibold mb-2">Keywords</h3>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(coach.keywords) ? coach.keywords : coach.keywords.split(',')).map((k: string) => (
                  <span
                    key={k}
                    className="inline-flex items-center px-3 py-1 rounded-full text-purple-700 bg-purple-50 border border-purple-300 text-sm font-semibold"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
          {coach.certifications && (
            <div className="flex-1 min-w-[180px]">
              <h3 className="text-base font-semibold mb-2">Certifications</h3>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(coach.certifications) ? coach.certifications : coach.certifications.split(',')).map((c: string) => (
                  <span
                    key={c}
                    className="inline-flex items-center px-3 py-1 rounded-full text-green-700 bg-green-50 border border-green-300 text-sm font-semibold"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {Object.keys(availabilityByDay).length > 0 && (
          <hr className="w-full border-t border-gray-200 my-6" />
        )}

        {Object.keys(availabilityByDay).length > 0 && (
          <div className="w-full">
            <h3 className="text-base font-semibold mb-2">Availability</h3>
            <div>
              {sortedAvailabilityDays.map((day) => (
                <div key={day} className="mb-1">
                  <span className="font-medium text-gray-800">{day}: </span>
                  {availabilityByDay[day].map((time, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-white bg-blue-600 text-xs font-semibold mr-1 mb-1"
                    >
                      {time}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {(coach.websiteUrl || linkedIn || (otherSocials && otherSocials.length > 0)) && (
          <hr className="w-full border-t border-gray-200 my-6" />
        )}

        {(coach.websiteUrl || linkedIn || (otherSocials && otherSocials.length > 0)) && (
          <div className="w-full flex flex-col md:flex-row gap-3 justify-between items-center">
            <div className="flex gap-3 flex-wrap">
              {coach.websiteUrl && (
                <SocialButton
                  url={coach.websiteUrl}
                  label="Website"
                  icon={<Globe className="h-5 w-5" />}
                />
              )}
              {linkedIn && (
                <SocialButton
                  url={linkedIn.url}
                  label="LinkedIn"
                  icon={<LinkedInIcon />}
                  className="text-[#0077b5]"
                />
              )}
            </div>
            {otherSocials && otherSocials.length > 0 && (
              <div className="flex flex-wrap gap-2">{otherSocials.map((s: any) =>
                <SocialButton
                  key={s.url}
                  label={s.platform}
                  icon={<UserCircle className="h-5 w-5" />}
                  url={s.url}
                />)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
