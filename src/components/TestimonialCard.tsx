
import type { Testimonial } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Star } from 'lucide-react'; 

interface TestimonialCardProps {
  testimonial: Testimonial;
}

export function TestimonialCard({ testimonial }: TestimonialCardProps) {
  return (
    <Card className="overflow-hidden shadow-lg h-full flex flex-col">
      <CardContent className="p-6 flex flex-col flex-grow">
        <div className="mb-4">
          <h3 className="font-semibold text-lg">{testimonial.name}</h3>
          {/* Designation was previously removed */}
        </div>
        <div className="flex mb-2">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          ))}
        </div>
        <p className="text-foreground/80 italic flex-grow">&ldquo;{testimonial.text}&rdquo;</p>
      </CardContent>
    </Card>
  );
}
