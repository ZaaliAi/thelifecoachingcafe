'use client';

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileEdit, Save, FileText, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { updateFirestoreBlogPost } from '@/lib/firestore';
import type { BlogPost, FirestoreBlogPost } from '@/types';
import Link from 'next/link';
import { uploadProfileImage } from '@/services/imageUpload'; // Using the standardized image upload service
import ReactMarkdown from 'react-markdown';

const blogPostEditSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters.'),
  content: z.string().min(50, 'Content must be at least 50 characters.'),
  excerpt: z.string().min(10, 'Excerpt must be at least 10 characters.').max(200, 'Excerpt must be at most 200 characters.').optional(),
  tags: z.string().optional(),
  status: z.enum(['draft', 'pending_approval', 'published', 'rejected']),
});

type BlogPostEditFormData = z.infer<typeof blogPostEditSchema>;

interface EditBlogPostFormProps {
  initialPostData: BlogPost;
  postId: string;
}

export default function EditBlogPostForm({ initialPostData, postId }: EditBlogPostFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [featuredImageFile, setFeaturedImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(initialPostData.featuredImageUrl || null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  const { toast } = useToast();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<BlogPostEditFormData>({
    resolver: zodResolver(blogPostEditSchema),
    defaultValues: {
      title: initialPostData.title,
      content: initialPostData.content,
      excerpt: initialPostData.excerpt || '',
      tags: initialPostData.tags?.join(', ') || '',
      status: initialPostData.status,
    }
  });

  const watchedContent = watch("content");

  useEffect(() => {
    reset({
        title: initialPostData.title,
        content: initialPostData.content,
        excerpt: initialPostData.excerpt || '',
        tags: initialPostData.tags?.join(', ') || '',
        status: initialPostData.status,
    });
    setImagePreview(initialPostData.featuredImageUrl || null);
  }, [initialPostData, reset]);

  function insertMarkdown(prefix: string, suffix: string) {
    const textarea = contentRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = textarea.value.substring(0, start) + prefix + selectedText + suffix + textarea.value.substring(end);
    setValue('content', newText, { shouldValidate: true, shouldDirty: true });
    textarea.focus();
    // ... logic to set selection
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
        setFeaturedImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    }
  }

  const onSubmit: SubmitHandler<BlogPostEditFormData> = async (data) => {
    if (!user || !initialPostData) return;
    setIsSubmitting(true);

    let finalImageUrl = initialPostData.featuredImageUrl;

    try {
        if (featuredImageFile) {
            toast({ title: "Uploading image..."});
            finalImageUrl = await uploadProfileImage(featuredImageFile, user.id, initialPostData.featuredImageUrl);
        } else if (imagePreview === null && initialPostData.featuredImageUrl) {
            // Image was removed
            await uploadProfileImage(undefined, user.id, initialPostData.featuredImageUrl);
            finalImageUrl = undefined;
        }

        const updateData: Partial<Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'authorId' | 'authorName'>> = {
          title: data.title,
          content: data.content,
          excerpt: data.excerpt,
          tags: data.tags?.split(',').map((tag) => tag.trim()).filter(Boolean) || [],
          featuredImageUrl: finalImageUrl,
          status: data.status,
        };

        await updateFirestoreBlogPost(postId, updateData);
        toast({ title: "Blog Post Updated!", description: `Your post has been saved as ${data.status}.` });
        router.push('/dashboard/coach/blog');

    } catch (error) {
        console.error("Error updating blog post:", error);
        toast({ title: "Update Failed", description: "Could not update your blog post.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const handleFormSubmitWithStatus = async (newStatus: BlogPost['status']) => {
    setValue('status', newStatus, { shouldValidate: true, shouldDirty: true });
    await handleSubmit(onSubmit)();
  };

  if (authLoading) return <div className="flex justify-center items-center h-full min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user || initialPostData.authorId !== user.id) return <div>Access Denied.</div>;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center"><FileEdit className="mr-3 h-7 w-7 text-primary" /> Edit Blog Post</CardTitle>
        <CardDescription>Modify your article and save the changes.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
            {/* Form Fields for Title, Content, Excerpt, Tags etc. */}
            <div className="space-y-2">
                <Label htmlFor="title">Post Title</Label>
                <Input id="title" {...register('title')} />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Content Textarea */}
                <div className="space-y-2">
                    <Label htmlFor="content">Content (Markdown)</Label>
                    <Textarea id="content" {...register('content')} rows={15} />
                    {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
                </div>
                {/* Markdown Preview */}
                <div className="space-y-2">
                    <Label>Live Preview</Label>
                    <div className="prose dark:prose-invert max-w-none p-4 border rounded-md min-h-[300px]"><ReactMarkdown>{watchedContent}</ReactMarkdown></div>
                </div>
            </div>
            
            <div className="space-y-2">
                <Label>Featured Image</Label>
                <Input type="file" accept="image/*" onChange={handleFileChange} />
                {imagePreview && (
                    <div className="mt-2">
                        <img src={imagePreview} alt="Preview" className="max-h-40 rounded border" />
                        <Button variant="link" size="sm" onClick={() => { setFeaturedImageFile(null); setImagePreview(null); }}>Remove Image</Button>
                    </div>
                )}
            </div>
        </CardContent>
        <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => handleFormSubmitWithStatus('draft')} disabled={isSubmitting}>Save Draft</Button>
            <Button type="button" onClick={() => handleFormSubmitWithStatus('pending_approval')} disabled={isSubmitting}>Submit for Approval</Button>
        </CardFooter>
      </form>
    </Card>
  );
}

// Helper function for markdown insertion
function insertMarkdown(textarea: HTMLTextAreaElement, prefix: string, suffix: string, setValue: Function) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const newText = textarea.value.substring(0, start) + prefix + selectedText + suffix + textarea.value.substring(end);
    setValue('content', newText, { shouldValidate: true, shouldDirty: true });
}
