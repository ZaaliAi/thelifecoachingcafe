
import Image from 'next/image';
import type { Testimonial } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Star, User } from 'lucide-react';

interface TestimonialCardProps {
  testimonial: Testimonial;
}

export function TestimonialCard({ testimonial }: TestimonialCardProps) {
  return (
    <Card className="overflow-hidden shadow-lg h-full flex flex-col">
      <CardContent className="p-6 flex flex-col flex-grow">
        <div className="flex items-center mb-4">
          <div className="relative h-14 w-14 mr-4 rounded-full overflow-hidden bg-muted flex-shrink-0">
            {testimonial.imageUrl ? (
              <Image
                src={testimonial.imageUrl}
                alt={testimonial.name}
                layout="fill"
                className="object-cover"
              />
            ) : (
              <div className="flex items-center justify-center h-full w-full">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{testimonial.name}</h3>
            {testimonial.designation && (
              <p className="text-sm text-muted-foreground">{testimonial.designation}</p>
            )}
          </div>
        </div>
        <div className="flex mb-4">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          ))}
        </div>
        <p className="text-foreground/80 italic flex-grow">&ldquo;{testimonial.text}&rdquo;</p>
      </CardContent>
    </Card>
  );
}
