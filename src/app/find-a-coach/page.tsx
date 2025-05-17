
"use client";

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CoachCard } from '@/components/CoachCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Lightbulb, Search } from 'lucide-react';
import type { CoachMatchAiSearchInput, CoachMatchAiSearchOutput } from '@/ai/flows/coach-match-ai';
import { coachMatchAiSearch } from '@/ai/flows/coach-match-ai'; // This needs to be callable client-side
import { mockCoaches } from '@/data/mock'; // Fallback mock data
import type { Coach } from '@/types';

const searchSchema = z.object({
  userInput: z.string().min(10, 'Please describe your needs in at least 10 characters.'),
});
type SearchFormData = z.infer<typeof searchSchema>;

// Helper to adapt AI output to Coach type if needed, or use mock data structure
const adaptAiCoachToAppCoach = (aiCoach: CoachMatchAiSearchOutput['rankedCoachList'][0]): Coach => {
  // Find a mock coach by name or ID to get more details, or use defaults
  const mockCoachDetail = mockCoaches.find(mc => mc.id === aiCoach.coachId || mc.name === aiCoach.coachName);
  return {
    id: aiCoach.coachId,
    name: aiCoach.coachName,
    bio: mockCoachDetail?.bio || 'Bio not available.',
    specialties: aiCoach.specialties,
    keywords: mockCoachDetail?.keywords || [],
    profileImageUrl: mockCoachDetail?.profileImageUrl,
    dataAiHint: mockCoachDetail?.dataAiHint as string,
    location: mockCoachDetail?.location,
    // matchScore: aiCoach.matchScore, // Can be added to Coach type if needed for display
  };
};


export default function FindACoachPage() {
  const [searchResults, setSearchResults] = useState<Coach[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
  });

  const onSubmit: SubmitHandler<SearchFormData> = async (data) => {
    setIsLoading(true);
    setError(null);
    setSearchResults(null);

    try {
      const input: CoachMatchAiSearchInput = { userInput: data.userInput };
      // In a real app, ensure coachMatchAiSearch is a server action or API endpoint
      // For now, we simulate the AI call
      // const response = await coachMatchAiSearch(input);

      // Simulate AI call and response structure
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
      const simulatedResponse: CoachMatchAiSearchOutput = {
        rankedCoachList: mockCoaches.slice(0,2).map(coach => ({
            coachId: coach.id,
            coachName: coach.name,
            matchScore: Math.random() * 100,
            specialties: coach.specialties.slice(0,2)
        })).sort((a,b) => b.matchScore - a.matchScore) // Sort by mock score
      };
      
      const adaptedCoaches = simulatedResponse.rankedCoachList.map(adaptAiCoachToAppCoach);
      setSearchResults(adaptedCoaches);

    } catch (e) {
      console.error('Error fetching coach recommendations:', e);
      setError('Failed to fetch coach recommendations. Please try again.');
      // Fallback to mock coaches on error
      setSearchResults(mockCoaches.slice(0, 2));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="text-center py-8">
        <Lightbulb className="mx-auto h-12 w-12 text-primary mb-4" />
        <h1 className="text-3xl md:text-4xl font-bold mb-4">CoachMatch AI Assistant</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Tell us what you&apos;re looking for in a life coach, and our AI will help you find the best matches.
        </p>
      </section>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Search className="mr-2 h-6 w-6 text-primary" />
            Describe Your Coaching Needs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Textarea
                {...register('userInput')}
                placeholder="e.g., 'I need help with career transition and building confidence.' or 'I'm looking for a coach who specializes in mindfulness and stress reduction.'"
                rows={5}
                className={`text-base ${errors.userInput ? 'border-destructive' : ''}`}
                aria-label="Describe your coaching needs"
              />
              {errors.userInput && (
                <p className="text-sm text-destructive mt-1">{errors.userInput.message}</p>
              )}
            </div>
            <Button type="submit" disabled={isLoading} size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Finding Coaches...
                </>
              ) : (
                'Find My Coach'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {searchResults && searchResults.length > 0 && (
        <section>
          <h2 className="text-2xl font-semibold mb-6">Recommended Coaches</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {searchResults.map((coach) => (
              <CoachCard key={coach.id} coach={coach} />
            ))}
          </div>
        </section>
      )}

      {searchResults && searchResults.length === 0 && !isLoading && (
        <Alert>
          <AlertTitle>No Coaches Found</AlertTitle>
          <AlertDescription>
            We couldn&apos;t find any coaches matching your current criteria. Try refining your search.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
