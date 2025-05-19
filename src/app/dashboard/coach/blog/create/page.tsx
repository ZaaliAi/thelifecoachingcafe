
"use client";

import { useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, PlusCircle, FileText, UploadCloud, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

const blogPostSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters.'),
  content: z.string().min(50, 'Content must be at least 50 characters.'),
  excerpt: z.string().min(10, 'Excerpt must be at least 10 characters.').max(200, 'Excerpt must be at most 200 characters.').optional(),
  tags: z.string().optional(), // Comma-separated
  featuredImageUrl: z.string().url('Invalid URL for featured image.').optional().or(z.literal('')),
  status: z.enum(['draft', 'pending_approval']),
});

type BlogPostFormData = z.infer<typeof blogPostSchema>;

export default function CreateBlogPostPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth();

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<BlogPostFormData>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: {
      status: 'draft',
    }
  });

  const onSubmit: SubmitHandler<BlogPostFormData> = async (data) => {
    if (!user || user.role !== 'coach') {
        toast({ title: "Unauthorized", description: "You must be a coach to create a blog post.", variant: "destructive"});
        return;
    }
    setIsLoading(true);
    try {
      const blogPostPayload = { 
        ...data, 
        authorId: user.id, 
        authorName: user.name || user.email,
        // createdAt: new Date().toISOString(), // Consider adding this in your actual save function
        // Potentially transform tags from comma-separated string to array in your actual save function
        // tags: data.tags ? data.tags.split(',').map(tag => tag.trim()) : [], 
      };
      console.log('Attempting to save new blog post with payload:', blogPostPayload);

      // TODO: Replace simulation with actual call to a function that saves to Firestore
      // For example:
      // import { createBlogPost } from '@/lib/firestore'; // Import this at the top of the file
      // const postId = await createBlogPost(blogPostPayload);
      // console.log('Blog post saved with ID:', postId);

      // Simulate API call (REMOVE THIS LINE WHEN REAL FIRESTORE CALL IS IMPLEMENTED)
      await new Promise(resolve => setTimeout(resolve, 1500)); 
      console.warn("SIMULATING BLOG POST SAVE. Implement actual createBlogPost() in a service file (e.g., firestore.ts) and call it here.");

      toast({
        title: "Blog Post Submitted!",
        description: `Your post "${data.title}" has been ${data.status === 'draft' ? 'saved as a draft' : 'submitted for approval'}.`,
      });
      router.push('/dashboard/coach/blog'); 
    } catch (error) {
      console.error("Failed to submit blog post:", error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your blog post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <PlusCircle className="mr-3 h-7 w-7 text-primary" />
          Create New Blog Post
        </CardTitle>
        <CardDescription>Share your knowledge and insights with the community.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Post Title</Label>
            <Input id="title" {...register('title')} placeholder="Your engaging blog post title" className={errors.title ? 'border-destructive' : ''} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea id="content" {...register('content')} rows={10} placeholder="Write your amazing blog post here... Supports Markdown." className={errors.content ? 'border-destructive' : ''} />
            {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt (Short summary)</Label>
            <Textarea id="excerpt" {...register('excerpt')} rows={3} placeholder="A brief summary for previews (max 200 characters)." className={errors.excerpt ? 'border-destructive' : ''} />
            {errors.excerpt && <p className="text-sm text-destructive">{errors.excerpt.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (Comma-separated)</Label>
              <Input id="tags" {...register('tags')} placeholder="e.g., mindfulness, career, wellness" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="featuredImageUrl">Featured Image URL (Optional)</Label>
              <div className="flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-muted-foreground" />
                <Input id="featuredImageUrl" {...register('featuredImageUrl')} placeholder="https://example.com/image.png" className={errors.featuredImageUrl ? 'border-destructive' : ''} />
              </div>
              {errors.featuredImageUrl && <p className="text-sm text-destructive">{errors.featuredImageUrl.message}</p>}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t">
            <Button type="submit" onClick={() => setValue('status', 'draft')} variant="outline" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                 Save as Draft
            </Button>
            <Button type="submit" onClick={() => setValue('status', 'pending_approval')} disabled={isLoading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Submit for Approval
            </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
