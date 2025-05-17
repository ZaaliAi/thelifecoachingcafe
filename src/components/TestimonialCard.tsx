
import Image from 'next/image';
import type { Testimonial } from '@/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Star } from 'lucide-react'; // Assuming 5-star rating for all testimonials

interface TestimonialCardProps {
  testimonial: Testimonial;
}

export function TestimonialCard({ testimonial }: TestimonialCardProps) {
  return (
    <Card className="overflow-hidden shadow-lg">
      <CardContent className="p-6">
        <div className="flex items-center mb-4">
          <Image
            src={testimonial.imageUrl || `https://placehold.co/80x80.png`}
            alt={testimonial.name}
            width={60}
            height={60}
            className="rounded-full mr-4 object-cover"
            data-ai-hint={testimonial.dataAiHint as string || "person face"}
          />
          <div>
            <h3 className="font-semibold text-lg">{testimonial.name}</h3>
            {/* The following line rendering designation has been removed */}
            {/*
            {testimonial.designation && (
              <p className="text-sm text-muted-foreground">{testimonial.designation}</p>
            )}
            */}
          </div>
        </div>
        <div className="flex mb-2">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          ))}
        </div>
        <p className="text-foreground/80 italic">&ldquo;{testimonial.text}&rdquo;</p>
      </CardContent>
    </Card>
  );
}
