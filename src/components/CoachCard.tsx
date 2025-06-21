
import Link from 'next/link';
import type { Coach } from '@/types';
import { Card, CardContent, CardFooter, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface CoachCardProps {
  coach: Coach;
}

export function CoachCard({ coach }: CoachCardProps) {
  const initials = coach.name
    ? coach.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'CC';

  return (
    <Card className="flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden">
      {coach.matchScore && (
        <div className="absolute top-2 right-2 bg-green-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-md z-10">
            {Math.round(coach.matchScore)}% Match
        </div>
      )}
      
      <div className="w-full h-32 bg-muted flex items-center justify-center">
        <Avatar className="w-28 h-28 border-4 border-background shadow-lg">
            <AvatarImage src={coach.profileImageUrl || ''} alt={`Profile picture of ${coach.name}`} className="object-cover" />
            <AvatarFallback className="text-3xl font-semibold bg-primary/10 text-primary">
                {initials}
            </AvatarFallback>
        </Avatar>
      </div>

      <CardContent className="p-6 flex-grow text-center">
        <CardTitle className="text-2xl mb-2">
          <Link href={`/coach/${coach.id}`} className="hover:text-primary transition-colors">
            {coach.name}
          </Link>
        </CardTitle>
        <p className="text-muted-foreground text-sm mb-4">{coach.tagline}</p>
        <div className="h-8 mb-4 flex items-center justify-center">
          {coach.specialties && coach.specialties[0] && (
            <p className="text-md font-semibold text-primary">{coach.specialties[0]}</p>
          )}
        </div>
        <p className="text-foreground/80 line-clamp-3 text-left">{coach.bio}</p>
      </CardContent>
      <CardFooter className="p-6 bg-muted/50 flex justify-between items-center">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Star className="w-4 h-4 text-yellow-500" />
            <span>{coach.averageRating?.toFixed(1) || 'New'}</span>
            <span className="ml-1">({coach.reviewCount || 0} reviews)</span>
        </div>
        <Button asChild>
          <Link href={`/coach/${coach.id}`}>View Profile</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
