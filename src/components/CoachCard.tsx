import Image from 'next/image';
import Link from 'next/link';
import type { Coach } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Briefcase, MapPin, MessageSquare, Crown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CoachCardProps {
  coach: Coach;
}

export function CoachCard({ coach }: CoachCardProps) {
  if (!coach || !coach.name) {
    // Return null or a placeholder if coach data is missing
    return null;
  }

  const initials = coach.name
    ? coach.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'CC'; // fallback initials

  return (
    <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 h-full">
      <CardHeader className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 p-6">
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
