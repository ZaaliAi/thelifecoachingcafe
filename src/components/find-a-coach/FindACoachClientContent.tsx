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
import { coachMatchAiSearch } from '@/ai/flows/coach-match-ai';
import type { Coach } from '@/types';
import { getCoachById } from '@/lib/firestore'; // Still needed for adaptAiCoachToAppCoach
import Link from 'next/link';

const searchSchema = z.object({
  userInput: z.string().min(10, 'Please describe your needs in at least 10 characters (e.g., "life coach for career change").'),
});
type SearchFormData = z.infer<typeof searchSchema>;

// Helper to adapt AI output to Coach type by fetching more details from Firestore
const adaptAiCoachToAppCoach = async (aiCoach: CoachMatchAiSearchOutput['rankedCoachList'][0]): Promise<Coach> => {
  const firestoreCoach = await getCoachById(aiCoach.coachId);
  if (firestoreCoach) {
    return {
      ...firestoreCoach, // All details from Firestore
      specialties: aiCoach.specialties.length > 0 ? aiCoach.specialties : firestoreCoach.specialties, // Prefer AI specialties if available, else Firestore's
      // matchScore: aiCoach.matchScore, // Can be added to Coach type if needed for display
    };
  }
  // Fallback if coach not found in Firestore (should be rare if AI is synced)
  return {
    id: aiCoach.coachId,
    name: aiCoach.coachName,
    bio: 'Detailed bio available on profile.',
    specialties: aiCoach.specialties,
    keywords: [],
    subscriptionTier: 'free', // Default, as we can't confirm without Firestore record
    // matchScore: aiCoach.matchScore,
  };
};

export default function FindACoachClientContent() {
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
      const response = await coachMatchAiSearch(input);

      const adaptedCoachesPromises = response.rankedCoachList.map(adaptAiCoachToAppCoach);
      const adaptedCoaches = await Promise.all(adaptedCoachesPromises);
      setSearchResults(adaptedCoaches);

    } catch (e) {
      console.error('Error fetching coach recommendations:', e);
      setError('Failed to fetch coach recommendations. Please try again or browse our directory.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="text-center py-8">
        <Lightbulb className="mx-auto h-12 w-12 text-primary mb-4" />
        <h1 className="text-3xl md:text-4xl font-bold mb-4">CoachMatch AI: Your Intelligent Coach Finder</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Describe your goals for personal development or mental wellness, and our AI will provide personalized coach suggestions to help you find the best-fit coach.
        </p>
      </section>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <Search className="mr-2 h-6 w-6 text-primary" />
            What are you looking for in a life coach?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Textarea
                {...register('userInput')}
                placeholder="e.g., 'I need a life coach for career change and confidence building.' or 'Help me find an online life coach specializing in mindset and stress reduction.'"
                rows={5}
                className={`text-base ${errors.userInput ? 'border-destructive' : ''}`}
                aria-label="Describe your coaching needs to find a life coach"
              />
              {errors.userInput && (
                <p className="text-sm text-destructive mt-1">{errors.userInput.message}</p>
              )}
            </div>
            <Button type="submit" disabled={isLoading} size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Finding Your Best-Fit Coach...
                </>
              ) : (
                'Get Personalized Coach Suggestions'
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
          <h2 className="text-2xl font-semibold mb-6">Your AI-Suggested Life Coach Matches</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {searchResults.map((coach) => (
              <CoachCard key={coach.id} coach={coach} />
            ))}
          </div>
        </section>
      )}

      {searchResults && searchResults.length === 0 && !isLoading && (
        <Alert>
          <AlertTitle>No Coaches Found Matching Your Needs</AlertTitle>
          <AlertDescription>
            We couldn't find specific AI-powered matches for your current criteria. Try refining your search, or <Link href="/browse-coaches" className="underline text-primary">browse our full life coach directory</Link>.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
