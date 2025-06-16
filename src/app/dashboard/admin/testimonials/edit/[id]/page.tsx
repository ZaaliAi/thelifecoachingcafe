"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import TestimonialForm from '@/components/dashboard/TestimonialForm';
import type { Testimonial } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

async function fetchTestimonialById(id: string): Promise<Testimonial | null> {
  const response = await fetch(`/api/testimonials/${id}`); // Assuming your GET by ID route is set up
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Failed to fetch testimonial');
  }
  return response.json();
}

export default function EditTestimonialPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [testimonial, setTestimonial] = useState<Testimonial | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const id = typeof params.id === 'string' ? params.id : null;

  const loadTestimonial = useCallback(async () => {
    if (!id) {
      setError("Testimonial ID is missing.");
      setIsLoading(false);
      toast({ title: "Error", description: "No testimonial ID provided.", variant: "destructive" });
      router.push('/dashboard/admin/testimonials'); // Redirect if no ID
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTestimonialById(id);
      if (data) {
        setTestimonial(data);
      } else {
        setError("Testimonial not found.");
        toast({ title: "Not Found", description: `Testimonial with ID ${id} could not be found.`, variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Error fetching testimonial:", err);
      setError(err.message || "Failed to load testimonial data.");
      toast({ title: "Error Loading Data", description: err.message, variant: "destructive" });
    }
    setIsLoading(false);
  }, [id, toast, router]);

  useEffect(() => {
    loadTestimonial();
  }, [loadTestimonial]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading testimonial data...</p>
      </div>
    );
  }

  if (error || !testimonial) {
    return (
      <Card className="max-w-lg mx-auto text-center py-12 bg-destructive/10 border-destructive">
        <CardHeader>
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3" />
          <CardTitle className="text-destructive">
            {error ? "Error Loading Testimonial" : "Testimonial Not Found"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive/80 mb-6">
            {error || `Could not find a testimonial with ID: ${id}.`}
          </p>
          <Button variant="outline" asChild>
            <Link href="/dashboard/admin/testimonials">Back to Testimonials List</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb removed */}
      <TestimonialForm initialData={testimonial} testimonialId={id} />
    </div>
  );
}
