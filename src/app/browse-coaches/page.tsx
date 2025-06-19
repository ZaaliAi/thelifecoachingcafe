
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CoachCard } from '@/components/CoachCard';
import { getAllCoaches } from '@/lib/firestore';
import { Search, Users } from 'lucide-react';
import type { Coach } from '@/types';
import type { Metadata } from 'next';

export function generateMetadata({ searchParams }: { searchParams?: { search?: string } }): Metadata {
  const searchTerm = searchParams?.search;
  const baseTitle = "Online Life Coach Directory | Browse Certified Coaches";
  const baseDescription = "Find and connect with certified life coaches in our comprehensive online directory. Search by specialty, name, or keyword to start your personal development journey.";

  if (searchTerm) {
    return {
      title: `Search Results for "${searchTerm}" | ${baseTitle}`,
      description: `Browse certified life coaches specializing in "${searchTerm}". Find the perfect expert for your personal growth, career, or wellness goals.`,
    };
  }

  return {
    title: baseTitle,
    description: baseDescription,
    metadataBase: new URL('https://thelifecoachingcafe.com'),
    openGraph: {
      title: baseTitle,
      description: baseDescription,
      images: ['/preview.jpg'],
      url: 'https://thelifecoachingcafe.com/browse-coaches',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: baseTitle,
      description: baseDescription,
      images: ['/preview.jpg'],
    },
  };
}


async function getCoaches(searchTerm?: string): Promise<Coach[]> {
  const coaches = await getAllCoaches({ searchTerm });
  console.log('Fetched Coaches Data (BrowseCoachesPage):', JSON.stringify(coaches, null, 2));
  return coaches;
}

export default async function BrowseCoachesPage({ searchParams: searchParamsProp }: { searchParams?: { search?: string } }) {
  // Await the searchParams promise if it's a promise (which it is with Turbopack in some cases)
  const resolvedSearchParams = await searchParamsProp;
  const searchTerm = resolvedSearchParams?.search;

  console.log("[BrowseCoachesPage] searchParamsProp (can be a Promise):", searchParamsProp);
  console.log("[BrowseCoachesPage] resolvedSearchParams:", resolvedSearchParams);
  console.log("[BrowseCoachesPage] Using searchTerm:", searchTerm);
  const coaches = await getCoaches(searchTerm);

  return (
    <div className="space-y-12">
      <section className="text-center py-8">
        <Users className="mx-auto h-12 w-12 text-primary mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Life Coach Directory: Find Certified Coaches Online</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Explore our online life coach directory of talented and certified life coaches. Use the search below to find a coach based on your specific needs for personal development, career change, or mental wellness.
        </p>
      </section>

      <section className="mb-8 p-6 bg-muted/50 rounded-lg shadow-sm">
        <form method="GET" action="/browse-coaches" className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-grow w-full sm:w-auto">
            <label htmlFor="search" className="block text-sm font-medium text-foreground mb-1">Search Life Coaches</label>
            <div className="relative">
              <Input 
                type="search" 
                name="search"
                id="search" 
                placeholder="Search life coaches by specialty (e.g., confidence, executive), name, or keyword..." 
                defaultValue={searchTerm}
                className="pl-10 h-11 text-base"
                aria-label="Search life coaches by name, specialty, or keyword"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <Button type="submit" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground h-11 text-base">
            <Search className="mr-2 h-4 w-4" /> Search Directory
          </Button>
        </form>
      </section>

      {coaches.length > 0 ? (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {coaches.map((coach) => (
            <CoachCard key={coach.id} coach={coach} />
          ))}
        </section>
      ) : (
        <section className="text-center py-12">
          <p className="text-xl text-muted-foreground">No life coaches found matching your search criteria.</p>
          <p className="text-muted-foreground mt-2">Try broadening your search terms or explore all certified life coaches.</p>
        </section>
      )}

      {/* Pagination Placeholder - Would require more logic */}
      {coaches.length > 0 && (
        <section className="mt-12 flex justify-center">
          <div className="flex gap-2">
            <Button variant="outline" disabled>Previous</Button>
            <Button variant="outline">Next</Button>
          </div>
        </section>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic';
