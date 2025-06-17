'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Testimonial } from '@/types'; // Ensure this matches the API response structure
import { Loader2, Trash2, PlusCircle, AlertTriangle } from 'lucide-react';

export default function CoachTestimonialsPage() {
  const { user, loading: authLoading, getFirebaseAuthToken } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [isLoadingTestimonials, setIsLoadingTestimonials] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [clientName, setClientName] = useState('');
  const [testimonialText, setTestimonialText] = useState('');
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  // Fetch testimonials
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'coach') {
      router.push('/dashboard'); // Or a generic dashboard / access-denied page
      toast({ title: 'Access Denied', description: 'This page is for coaches only.', variant: 'destructive' });
      return;
    }

    if (user.subscriptionTier !== 'premium') {
      router.push('/dashboard/coach'); // Redirect non-premium coaches to their main dashboard
      toast({ title: 'Premium Feature', description: 'Managing testimonials is a premium feature. Please upgrade your plan.', variant: 'destructive' });
      return;
    }

    // User is authenticated, is a coach, and is premium. Proceed to fetch testimonials.
    const fetchTestimonials = async () => {
      setIsLoadingTestimonials(true);
      setError(null);
      const token = await getFirebaseAuthToken();
      if (!token) {
        setError('Authentication token not available.');
        setIsLoadingTestimonials(false);
        toast({ title: 'Error', description: 'Authentication token not available.', variant: 'destructive' });
        return;
      }

      try {
        const response = await fetch(`/api/coachtestimonials?coachId=${user.id}`, { // UPDATED
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to fetch testimonials' }));
          throw new Error(errorData.error || errorData.message);
        }
        const data: Testimonial[] = await response.json();
        setTestimonials(data);
      } catch (e: any) {
        setError(e.message || 'An error occurred while fetching testimonials.');
        toast({ title: 'Error Fetching Testimonials', description: e.message, variant: 'destructive' });
      } finally {
        setIsLoadingTestimonials(false);
      }
    };

    fetchTestimonials();
  }, [user, authLoading, router, getFirebaseAuthToken, toast]);

  const handleDeleteTestimonial = async (testimonialId: string) => {
    const token = await getFirebaseAuthToken();
    if (!token) {
      toast({ title: 'Error', description: 'Authentication token not available.', variant: 'destructive' });
      return;
    }

    const originalTestimonials = [...testimonials];
    setTestimonials(testimonials.filter(t => t.id !== testimonialId)); // Optimistic update

    try {
      const response = await fetch(`/api/coachtestimonials/${testimonialId}`, { // UPDATED
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete testimonial' }));
        throw new Error(errorData.error || errorData.message);
      }
      toast({ title: 'Success', description: 'Testimonial deleted successfully.' });
    } catch (e: any) {
      setTestimonials(originalTestimonials); // Revert optimistic update
      toast({ title: 'Error Deleting Testimonial', description: e.message, variant: 'destructive' });
      setError(`Failed to delete testimonial: ${e.message}`);
    }
  };

  const handleAddTestimonial = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (testimonials.length >= 10) {
      toast({ title: 'Limit Reached', description: 'You cannot add more than 10 testimonials.', variant: 'destructive' });
      return;
    }
    if (!clientName.trim() || !testimonialText.trim()) {
      toast({ title: 'Validation Error', description: 'Client Name and Testimonial Text are required.', variant: 'destructive'});
      return;
    }

    setIsSubmittingForm(true);
    setError(null);
    const token = await getFirebaseAuthToken();
    if (!token) {
      toast({ title: 'Error', description: 'Authentication token not available.', variant: 'destructive' });
      setIsSubmittingForm(false);
      return;
    }

    try {
      const response = await fetch('/api/coachtestimonials', { // UPDATED
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clientName, testimonialText }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to add testimonial' }));
        throw new Error(errorData.error || errorData.message);
      }

      // Refetch testimonials to get the new one with its ID and server-generated createdAt
      // Or, if the API returns the created object, we can add it to the state directly.
      // For simplicity and to ensure data consistency (e.g., server-generated timestamps), refetching is safer.
      toast({ title: 'Success', description: 'Testimonial added successfully! Refreshing list...' });
      setClientName('');
      setTestimonialText('');
      // Trigger refetch
      if (user && user.id) {
        const updatedResponse = await fetch(`/api/coachtestimonials?coachId=${user.id}`, { // UPDATED
          headers: { Authorization: `Bearer ${token}` },
        });
        const updatedData: Testimonial[] = await updatedResponse.json();
        setTestimonials(updatedData);
      }

    } catch (e: any) {
      toast({ title: 'Error Adding Testimonial', description: e.message, variant: 'destructive' });
      setError(`Failed to add testimonial: ${e.message}`);
    } finally {
      setIsSubmittingForm(false);
    }
  };


  if (authLoading || (isLoadingTestimonials && !testimonials.length)) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && !authLoading) {
     // This case is primarily handled by the useEffect redirect, but good for initial render before effect runs
    return null;
  }

  // Specific handling for non-premium coaches after loading state, before rendering main content
  if (user && user.role === 'coach' && user.subscriptionTier !== 'premium' && !authLoading) {
    // The useEffect above should have already redirected.
    // This is a fallback or for cases where redirect hasn't happened yet or to show a message.
    // For now, relying on useEffect redirect mostly. Can enhance this with a message if needed.
    // Or, to be more explicit and show a message before potential redirect:
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold text-primary">Premium Feature</h1>
        <p className="my-4">Managing client testimonials is a premium feature.</p>
        <p>Please upgrade your plan to access this page.</p>
        <Button onClick={() => router.push('/pricing')} className="mt-6">View Pricing Plans</Button>
        {/* Assuming /pricing is the route for upgrade plans */}
      </div>
    );
  }

  // General access denied for non-coaches (also handled by useEffect, but good as a fallback)
  if (user && user.role !== 'coach' && !authLoading) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p>You do not have permission to view this page.</p>
        <Button onClick={() => router.push('/dashboard')} className="mt-6">Go to Dashboard</Button>
      </div>
    );
  }

  // If user is a coach and premium (or checks passed in useEffect), render the page:
  return (
    <div className="container mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-8">Manage Your Testimonials</h1>

      {/* Add Testimonial Form */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center"><PlusCircle className="mr-2" /> Add New Testimonial</CardTitle>
          {testimonials.length >= 10 && (
            <CardDescription className="text-destructive flex items-center mt-2">
              <AlertTriangle className="mr-2 h-4 w-4" /> You have reached the maximum of 10 testimonials.
            </CardDescription>
          )}
        </CardHeader>
        <form onSubmit={handleAddTestimonial}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="clientName">Client&apos;s Name</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client's full name"
                disabled={testimonials.length >= 10 || isSubmittingForm}
              />
            </div>
            <div>
              <Label htmlFor="testimonialText">Testimonial Text</Label>
              <Textarea
                id="testimonialText"
                value={testimonialText}
                onChange={(e) => setTestimonialText(e.target.value)}
                placeholder="Write the testimonial content here..."
                rows={4}
                disabled={testimonials.length >= 10 || isSubmittingForm}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={testimonials.length >= 10 || isSubmittingForm}>
              {isSubmittingForm ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Add Testimonial
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Display Testimonials */}
      <h2 className="text-2xl font-semibold mb-6">Your Current Testimonials ({testimonials.length})</h2>
      {isLoadingTestimonials && !testimonials.length && <p>Loading testimonials...</p>}
      {error && <p className="text-destructive mb-4">Error: {error}</p>}

      {!isLoadingTestimonials && testimonials.length === 0 && !error && (
        <p>You haven&apos;t added any testimonials yet.</p>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((testimonial) => (
          <Card key={testimonial.id} className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-lg">{testimonial.clientName}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground italic">&ldquo;{testimonial.testimonialText}&rdquo;</p>
            </CardContent>
            <CardFooter className="border-t pt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteTestimonial(testimonial.id)}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
