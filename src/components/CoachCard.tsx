import Image from 'next/image';
import Link from 'next/link';
import type { Coach } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Briefcase, MapPin, MessageSquare } from 'lucide-react';

interface CoachCardProps {
  coach: Coach;
}

export function CoachCard({ coach }: CoachCardProps) {
  return (
    <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="relative p-0">
        <Image
          src={coach.profileImageUrl || `https://placehold.co/400x300.png`}
          alt={coach.name}
          width={400}
          height={300}
          className="object-cover w-full h-48"
          data-ai-hint={coach.dataAiHint as string || "person portrait"}
        />
      </CardHeader>
      <CardContent className="p-6 flex-grow">
        <CardTitle className="text-xl font-semibold mb-2">{coach.name}</CardTitle>
        {coach.location && (
          <div className="flex items-center text-sm text-muted-foreground mb-2">
            <MapPin className="h-4 w-4 mr-1" />
            {coach.location}
          </div>
        )}
        <div className="flex items-center text-sm text-muted-foreground mb-3">
          <Briefcase className="h-4 w-4 mr-1" />
          Specialties
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {coach.specialties.slice(0, 3).map((specialty) => (
            <Badge key={specialty} variant="secondary" className="text-xs">
              {specialty}
            </Badge>
          ))}
          {coach.specialties.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{coach.specialties.length - 3} more
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {coach.bio}
        </p>
      </CardContent>
      <CardFooter className="p-6 border-t">
        <div className="flex gap-2 w-full">
        <Button asChild variant="outline" className="flex-1">
            <Link href={`/coach/${coach.id}`}>View Profile</Link>
          </Button>
          <Button asChild className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
            <Link href={`/messages/new?coachId=${coach.id}`}>
              <MessageSquare className="mr-2 h-4 w-4" /> Message
            </Link>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
