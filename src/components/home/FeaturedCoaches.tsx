
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
Carousel,
CarouselContent,
CarouselItem,
CarouselNext,
CarouselPrevious,
} from "@/components/ui/carousel";
import { getFeaturedCoaches } from "@/lib/firestore";
import CoachCard from "@/components/coaches/CoachCard";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function FeaturedCoaches() {
const coaches = await getFeaturedCoaches();

return (
<div className="w-full py-12">
<Card>
<CardHeader>
<CardTitle>Featured Coaches</CardTitle>
</CardHeader>
<CardContent>
<Carousel
opts={{
align: "start",
}}
className="w-full"
>
<CarouselContent>
{coaches.map((coach) => (
<CarouselItem key={coach.id} className="md:basis-1/2 lg:basis-1/3">
<div className="p-1">
<CoachCard coach={coach} />
</div>
</CarouselItem>
))}
</CarouselContent>
<CarouselPrevious />
<CarouselNext />
</Carousel>
</CardContent>
</Card>
<div className="text-center mt-8">
<Button asChild variant="outline" size="lg">
<Link href="/browse-coaches">View All Coaches</Link>
</Button>
</div>
</div>
);
}
