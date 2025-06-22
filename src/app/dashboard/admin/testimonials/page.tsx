"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader2, Trash2, AlertTriangle, Edit, PlusCircle } from "lucide-react";
import type { HomepageTestimonial } from '@/types'; // Correctly import HomepageTestimonial
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

async function fetchTestimonialsFromAPI(authToken: string): Promise<HomepageTestimonial[]> {
  const response = await fetch('/api/testimonials', {
    headers: {
        'Authorization': `Bearer ${authToken}`
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch testimonials');
  }
  return response.json();
}

async function deleteTestimonialFromAPI(id: string, authToken: string): Promise<void> {
  const response = await fetch(`/api/testimonials/${id}`, { 
    method: 'DELETE',
    headers: {
        'Authorization': `Bearer ${authToken}`
    }
});
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to delete testimonial');
  }
}

export default function AdminManageTestimonialsPage() {
  const [testimonials, setTestimonials] = useState<HomepageTestimonial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { getFirebaseAuthToken } = useAuth();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTestimonials = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const authToken = await getFirebaseAuthToken();
    if (!authToken) {
        setError("Authentication token not found. Please log in again.");
        setIsLoading(false);
        return;
    }
    try {
      const data = await fetchTestimonialsFromAPI(authToken);
      data.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return 0;
      });
      setTestimonials(data);
    } catch (err: any) {
      console.error("Error fetching testimonials:", err);
      setError(err.message || "Failed to load testimonials. Please try again.");
      toast({
        title: "Error Loading Testimonials",
        description: err.message || "Could not fetch testimonials.",
        variant: "destructive"
      });
    }
    setIsLoading(false);
  }, [toast, getFirebaseAuthToken]);

  useEffect(() => {
    fetchTestimonials();
  }, [fetchTestimonials]);

  const handleDeleteTestimonial = async (id: string) => {
    const authToken = await getFirebaseAuthToken();
    if (!authToken) {
        toast({ title: "Authentication Error", description: "Cannot delete without a valid token.", variant: "destructive" });
        return;
    }

    const originalTestimonials = [...testimonials];
    const testimonialToDelete = testimonials.find(t => t.id === id);
    if (!testimonialToDelete) return;

    setTestimonials(prev => prev.filter(t => t.id !== id));
    setDeletingId(null);

    try {
      await deleteTestimonialFromAPI(id, authToken);
      toast({
        title: "Testimonial Deleted",
        description: `Testimonial by "${testimonialToDelete.name}" has been successfully deleted.`,
      });
    } catch (err: any) {
      console.error("Error deleting testimonial:", err);
      setTestimonials(originalTestimonials);
      toast({
        title: "Deletion Failed",
        description: err.message || "Could not delete the testimonial.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Loading testimonials...</div>;
  }

  if (error) {
    return (
      <Card className="text-center py-12 bg-destructive/10 border-destructive">
        <CardHeader>
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-3" />
          <CardTitle className="text-destructive">Error Loading Data</CardTitle>
          <CardDescription className="text-destructive/80">{error}</CardDescription>
        </CardHeader>
        <CardContent>
           <Button onClick={fetchTestimonials} variant="outline">Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-2xl flex items-center">
            <FileText className="mr-3 h-7 w-7 text-primary" /> Manage Homepage Testimonials
          </CardTitle>
          <CardDescription>Add, edit, or delete testimonials displayed on the homepage.</CardDescription>
        </div>
        <Button asChild>
          <Link href="/dashboard/admin/testimonials/new">
            <PlusCircle className="mr-2 h-4 w-4" /> Add Testimonial
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {testimonials.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No testimonials found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[20%]">Name</TableHead>
                <TableHead className="w-[40%]">Text</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Updated At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testimonials.map((testimonial) => (
                <TableRow key={testimonial.id}>
                  <TableCell className="font-medium">{testimonial.name}</TableCell>
                  <TableCell className="max-w-md truncate" title={testimonial.text}>{testimonial.text}</TableCell>
                  <TableCell>{testimonial.createdAt ? format(new Date(testimonial.createdAt), 'PP pp') : 'N/A'}</TableCell>
                  <TableCell>{testimonial.updatedAt ? format(new Date(testimonial.updatedAt), 'PP pp') : 'N/A'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="sm" asChild title="Edit Testimonial">
                        <Link href={`/dashboard/admin/testimonials/edit/${testimonial.id}`}>
                            <Edit className="h-4 w-4" />
                        </Link>
                    </Button>
                    <AlertDialog open={deletingId === testimonial.id} onOpenChange={(open) => !open && setDeletingId(null)}>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive/90 hover:bg-destructive/10" title="Delete Testimonial" onClick={() => setDeletingId(testimonial.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the testimonial by "{testimonial.name}".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTestimonial(testimonial.id)} className="bg-destructive hover:bg-destructive/90">
                            Yes, delete testimonial
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
