"use client";

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Search } from 'lucide-react';
import type { Coach } from '@/types';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const searchSchema = z.object({
  userInput: z.string().min(10, 'Please describe your needs in at least 10 characters (e.g., "life coach for career change").'),
});
type SearchFormData = z.infer<typeof searchSchema>;


export default function HomePageClientContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors } } = useForm<SearchFormData>({
    resolver: zodResolver(searchSchema),
  });

  const onSubmit: SubmitHandler<SearchFormData> = async (data) => {
    setIsLoading(true);
    setError(null);
    try {
      // Store the search query in local storage to be picked up by the find-a-coach page
      localStorage.setItem('homePageSearchQuery', data.userInput);
      // Redirect to the find-a-coach page
      router.push('/find-a-coach');
    } catch (e) {
      console.error('Error redirecting to coach recommendations:', e);
      setError('Failed to start the coach matching process. Please try again.');
      setIsLoading(false);
    }
  };

  return (
      <section className="py-8">
        <Card className="shadow-lg">
            <CardContent className="text-center p-6 space-y-4">
                <h2 className="text-2xl font-bold">
                    Instantly find your Coach free with <span className="text-primary">CoachMatch AI<sup className="align-super text-sm">&trade;</sup></span>
                </h2>
                <p className="text-muted-foreground">
                Type your requirements below for a quick match, or for more detailed briefs head to the <Link href="/find-a-coach" className="text-primary hover:underline">CoachMatch AI page</Link>.
                </p>
                <form onSubmit={handleSubmit(onSubmit)} className="flex w-full max-w-3xl items-center space-x-2 mx-auto">
                <Input 
                    {...register('userInput')}
                    type="text" 
                    placeholder="e.g. 'I need a coach for career transition'" 
                    className="h-12 text-base" 
                />
                <Button type="submit" size="lg" className="h-12 text-base" disabled={isLoading}>
                    {isLoading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                    <Search className="mr-2 h-5 w-5" />
                    )}
                    Match Me
                </Button>
                </form>
                {errors.userInput && (
                <p className="text-sm text-destructive mt-1">{errors.userInput.message}</p>
                )}
                {error && (
                <Alert variant="destructive" className="mt-4 max-w-3xl mx-auto">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            </CardContent>
        </Card>
      </section>
  );
}
