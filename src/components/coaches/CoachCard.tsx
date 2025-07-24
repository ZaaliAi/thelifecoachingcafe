
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Coach } from '@/types';

type CoachCardProps = {
  coach: Coach;
};

export default function CoachCard({ coach }: CoachCardProps) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex-row items-center gap-4">
        <Avatar>
          <AvatarImage src={coach.profilePictureUrl} alt={coach.name} />
          <AvatarFallback>{coach.name[0]}</AvatarFallback>
        </Avatar>
        <div>
          <CardTitle>{coach.name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground">{coach.specialties.join(', ')}</p>
        <p className="mt-4 line-clamp-3">{coach.bio}</p>
      </CardContent>
      <CardFooter>
        <Button asChild>
          <Link href={`/coach/${coach.id}`}>View Profile</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
