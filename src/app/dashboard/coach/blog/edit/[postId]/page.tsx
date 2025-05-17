
"use client";

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileEdit, UploadCloud, Save, FileText, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { getFirestoreBlogPost, updateFirestoreBlogPost } from '@/lib/firestore';
import type { BlogPost, FirestoreBlogPost } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

const blogPostEditSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters.'),
  content: z.string().min(50, 'Content must be at least 50 characters.'),
  excerpt: z.string().min(10, 'Excerpt must be at least 10 characters.').max(200, 'Excerpt must be at most 200 characters.').optional(),
  tags: z.string().optional(), // Comma-separated
  featuredImageUrl: z.string().url('Invalid URL for featured image.').optional().or(z.literal('')),
  status: z.enum(['draft', 'pending_approval', 'published', 'rejected']), // Keep original status or set new one
});

type BlogPostEditFormData = z.infer<typeof blogPostEditSchema>;

export default function EditBlogPostPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingPost, setIsFetchingPost] = useState(true);
  const [post, setPost] = useState<BlogPost | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const postId = params.postId as string;

  const { register, handleSubmit, formState: { errors }, reset, setValue, control } = useForm<BlogPostEditFormData>({
    resolver: zodResolver(blogPostEditSchema),
  });

  useEffect(() => {
    if (!postId || authLoading) return;

    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to edit a blog post.", variant: "destructive" });
      router.push('/login');
      return;
    }

    const fetchPost = async () => {
      setIsFetchingPost(true);
      try {
        const fetchedPost = await getFirestoreBlogPost(postId);
        if (fetchedPost) {
          if (fetchedPost.authorId !== user.id) {
            toast({ title: "Unauthorized", description: "You can only edit your own blog posts.", variant: "destructive" });
            router.push('/dashboard/coach/blog');
            return;
          }
          setPost(fetchedPost);
          reset({
            title: fetchedPost.title,
            content: fetchedPost.content,
            excerpt: fetchedPost.excerpt || '',
            tags: fetchedPost.tags?.join(', ') || '',
            featuredImageUrl: fetchedPost.featuredImageUrl || '',
            status: fetchedPost.status, // Keep the original status for initial form state
          });
        } else {
          toast({ title: "Post Not Found", description: "The blog post you are trying to edit does not exist.", variant: "destructive" });
          router.push('/dashboard/coach/blog');
        }
      } catch (error) {
        console.error("Error fetching blog post:", error);
        toast({ title: "Error", description: "Failed to fetch the blog post.", variant: "destructive" });
      } finally {
        setIsFetchingPost(false);
      }
    };

    fetchPost();
  }, [postId, user, authLoading, reset, router, toast]);

  const onSubmit: SubmitHandler<BlogPostEditFormData> = async (data) => {
    if (!user || !post) {
      toast({ title: "Error", description: "User not authenticated or post data missing.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    const updateData: Partial<Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'authorId' | 'authorName'>> = {
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      tags: data.tags?.split(',').map(tag => tag.trim()).filter(Boolean) || [],
      featuredImageUrl: data.featuredImageUrl,
      status: data.status, // The status is set by which button is clicked
      // slug will not be updated to maintain URL integrity, or would require complex redirect logic
    };

    try {
      await updateFirestoreBlogPost(postId, updateData);
      toast({
        title: "Blog Post Updated!",
        description: `Your post "${data.title}" has been updated and saved as ${data.status === 'draft' ? 'a draft' : (data.status === 'pending_approval' ? 'pending approval' : data.status)}.`,
      });
      router.push('/dashboard/coach/blog');
    } catch (error) {
      console.error("Error updating blog post:", error);
      toast({ title: "Update Failed", description: "Could not update your blog post.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFormSubmit = (newStatus: BlogPost['status']) => {
    setValue('status', newStatus); // Set the status right before submitting
    handleSubmit(onSubmit)();
  };


  if (authLoading || isFetchingPost) {
    return (
      <div className="flex justify-center items-center h-full min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading post details...</span>
      </div>
    );
  }

  if (!post) {
    // This case should be handled by the redirect in useEffect, but as a fallback:
    return (
       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <AlertCircle className="mr-3 h-7 w-7 text-destructive" />
            Post Not Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>The blog post you are trying to edit could not be found or you do not have permission to edit it.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/dashboard/coach/blog">Back to My Blog Posts</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <FileEdit className="mr-3 h-7 w-7 text-primary" />
          Edit Blog Post: {post.title}
        </CardTitle>
        <CardDescription>Modify your article and save the changes.</CardDescription>
      </CardHeader>
      <form> {/* We use handleSubmit from react-hook-form, actual submission is handled by buttons */}
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
            <Button type="button" onClick={() => handleFormSubmit('draft')} variant="outline" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                 Save as Draft
            </Button>
            <Button 
              type="button" 
              onClick={() => handleFormSubmit(post.status === 'published' ? 'published' : 'pending_approval')} 
              disabled={isLoading} 
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                {post.status === 'published' ? 'Update Published Post' : 'Submit for Approval'}
            </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

    