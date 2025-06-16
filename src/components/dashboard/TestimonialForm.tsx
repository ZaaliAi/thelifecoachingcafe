'use client';

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save, MessageSquareText, AlertCircle } from 'lucide-react'; // Changed icon
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { Testimonial } from '@/types'; // Assuming Testimonial type includes id, name, text, imageUrl, designation, createdAt, updatedAt

const testimonialFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.').max(100, 'Name must be at most 100 characters.'),
  text: z.string().min(10, 'Testimonial text must be at least 10 characters.').max(1000, 'Testimonial text must be at most 1000 characters.'),
  imageUrl: z.string().url('Invalid URL for image.').optional().or(z.literal('')),
  designation: z.string().max(100, 'Designation must be at most 100 characters.').optional().or(z.literal('')),
});

type TestimonialFormData = z.infer<typeof testimonialFormSchema>;

interface TestimonialFormProps {
  initialData?: Testimonial | null; // Make initialData optional for creation
  testimonialId?: string | null; // To distinguish between create and edit
  onSave?: () => void; // Optional callback after saving
}

export default function TestimonialForm({ initialData = null, testimonialId = null, onSave }: TestimonialFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const isEditMode = Boolean(testimonialId && initialData);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<TestimonialFormData>({
    resolver: zodResolver(testimonialFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      text: initialData?.text || '',
      imageUrl: initialData?.imageUrl || '',
      designation: initialData?.designation || '',
    }
  });

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        text: initialData.text,
        imageUrl: initialData.imageUrl || '',
        designation: initialData.designation || '',
      });
    } else {
      // Reset to empty for create form if no initialData (e.g. navigating directly to 'new' page)
      reset({ name: '', text: '', imageUrl: '', designation: '' });
    }
  }, [initialData, reset]);

  const onSubmit: SubmitHandler<TestimonialFormData> = async (data) => {
    setIsSubmitting(true);
    const apiUrl = isEditMode ? `/api/testimonials/${testimonialId}` : '/api/testimonials';
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(apiUrl, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
        throw new Error(errorData.error || errorData.message || `Failed to ${isEditMode ? 'update' : 'create'} testimonial`);
      }

      const result = await response.json();

      toast({
        title: `Testimonial ${isEditMode ? 'Updated' : 'Created'}!`,
        description: `The testimonial from "${result.name}" has been successfully ${isEditMode ? 'updated' : 'saved'}.`,
      });

      if (onSave) {
        onSave();
      } else {
        // Default behavior if no onSave callback (e.g. redirect)
        router.push('/dashboard/admin/testimonials');
        router.refresh(); // Ensure the list page re-fetches data
      }

    } catch (error: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} testimonial:`, error);
      toast({
        title: `${isEditMode ? 'Update' : 'Creation'} Failed`,
        description: error.message || `Could not ${isEditMode ? 'update' : 'create'} the testimonial. Please try again.`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <MessageSquareText className="mr-3 h-7 w-7 text-primary" />
          {isEditMode ? 'Edit Testimonial' : 'Add New Testimonial'}
        </CardTitle>
        <CardDescription>
          {isEditMode ? 'Modify the details of the testimonial below.' : 'Fill in the details to add a new testimonial.'}
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <Label htmlFor="name" className={errors.name ? 'text-destructive' : ''}>Name (Required)</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Client's Full Name"
              className={errors.name ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {errors.name && <p className="text-sm text-destructive flex items-center mt-1"><AlertCircle className="h-4 w-4 mr-1" />{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="text" className={errors.text ? 'text-destructive' : ''}>Testimonial Text (Required)</Label>
            <Textarea
              id="text"
              {...register('text')}
              rows={5}
              placeholder="Enter the client's testimonial here..."
              className={errors.text ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {errors.text && <p className="text-sm text-destructive flex items-center mt-1"><AlertCircle className="h-4 w-4 mr-1" />{errors.text.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="designation">Designation / Company (Optional)</Label>
            <Input
              id="designation"
              {...register('designation')}
              placeholder="e.g., CEO at Company Inc."
              className={errors.designation ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {errors.designation && <p className="text-sm text-destructive flex items-center mt-1"><AlertCircle className="h-4 w-4 mr-1" />{errors.designation.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL (Optional)</Label>
            <Input
              id="imageUrl"
              {...register('imageUrl')}
              type="url"
              placeholder="https://example.com/image.png"
              className={errors.imageUrl ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {errors.imageUrl && <p className="text-sm text-destructive flex items-center mt-1"><AlertCircle className="h-4 w-4 mr-1" />{errors.imageUrl.message}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end pt-6 border-t">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting} className="mr-2">
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isEditMode ? 'Save Changes' : 'Add Testimonial'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
