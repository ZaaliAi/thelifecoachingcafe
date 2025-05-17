
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CoachCard } from '@/components/CoachCard';
import { mockCoaches } from '@/data/mock';
import { Search, Users } from 'lucide-react';
import type { Coach } from '@/types';

async function getCoaches(searchTerm?: string): Promise<Coach[]> {
  // Simulate fetching and filtering
  await new Promise(resolve => setTimeout(resolve, 100)); 
  let coaches = mockCoaches;

  if (searchTerm) {
    const lowerSearchTerm = searchTerm.toLowerCase();
    coaches = coaches.filter(coach =>
      coach.name.toLowerCase().includes(lowerSearchTerm) ||
      coach.bio.toLowerCase().includes(lowerSearchTerm) ||
      coach.specialties.some(s => s.toLowerCase().includes(lowerSearchTerm)) ||
      coach.keywords.some(k => k.toLowerCase().includes(lowerSearchTerm))
    );
  }
  return coaches;
}

export default async function BrowseCoachesPage({ searchParams }: { searchParams?: { search?: string } }) {
  const searchTerm = searchParams?.search;
  const coaches = await getCoaches(searchTerm);

  return (
    <div className="space-y-12">
      <section className="text-center py-8">
        <Users className="mx-auto h-12 w-12 text-primary mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Browse Our Coaches</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Explore our directory of talented life coaches. Use the search below to find a coach based on your specific needs.
        </p>
      </section>

      <section className="mb-8 p-6 bg-muted/50 rounded-lg shadow-sm">
        <form method="GET" action="/browse-coaches" className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-grow w-full sm:w-auto">
            <label htmlFor="search" className="block text-sm font-medium text-foreground mb-1">Search Coaches</label>
            <div className="relative">
              <Input 
                type="search" 
                name="search"
                id="search" 
                placeholder="Search by name, specialty, keyword..." 
                defaultValue={searchTerm}
                className="pl-10 h-11 text-base"
                aria-label="Search coaches"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <Button type="submit" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground h-11 text-base">
            <Search className="mr-2 h-4 w-4" /> Search
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
          <p className="text-xl text-muted-foreground">No coaches found matching your search criteria.</p>
          <p className="text-muted-foreground mt-2">Try broadening your search terms or explore all coaches.</p>
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

export const dynamic = 'force-dynamic'; // Ensure searchParams are re-evaluated for each request
