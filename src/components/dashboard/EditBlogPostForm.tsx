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
import { Loader2, FileEdit, Save, FileText, Eye, Bold, Italic, Heading2, Link as LinkIcon, List, Quote } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { updateFirestoreBlogPost } from '@/lib/firestore';
import type { BlogPost, FirestoreBlogPost } from '@/types';
import Link from 'next/link';
import { uploadProfileImage } from '@/services/imageUpload';
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

  const contentFieldRegistration = register('content');
  const watchedContent = watch("content", initialPostData.content);

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

  const handleMarkdownClick = (prefix: string, suffix: string = '') => {
    const textarea = contentRef.current;
    if (textarea) {
        insertMarkdown(textarea, prefix, suffix, setValue);
    }
  };

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
            <div className="space-y-2">
                <Label htmlFor="title">Post Title</Label>
                <Input id="title" {...register('title')} />
                {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="excerpt">Blog Summary / Excerpt</Label>
                <Textarea id="excerpt" {...register('excerpt')} rows={3} placeholder="A short summary of the post."/>
                {errors.excerpt && <p className="text-sm text-destructive">{errors.excerpt.message}</p>}
            </div>
            
            <div className="space-y-2">
                <Label>Markdown Toolbar</Label>
                <div className="flex space-x-2 border rounded-md p-2 bg-muted">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleMarkdownClick('**', '**')}><Bold className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleMarkdownClick('*', '*')}><Italic className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleMarkdownClick('## ')}><Heading2 className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleMarkdownClick('> ')}><Quote className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleMarkdownClick('[', '](url)')}><LinkIcon className="h-4 w-4" /></Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleMarkdownClick('- ')}><List className="h-4 w-4" /></Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="content">Content (Markdown)</Label>
                    <Textarea 
                        id="content"
                        rows={15} 
                        {...contentFieldRegistration}
                        ref={(e) => {
                          contentFieldRegistration.ref(e);
                          contentRef.current = e;
                        }}
                    />
                    {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label>Live Preview</Label>
                    <div className="prose dark:prose-invert max-w-none p-4 border rounded-md min-h-[300px] bg-muted/40"><ReactMarkdown>{watchedContent}</ReactMarkdown></div>
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
            
            <div className="space-y-2">
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input id="tags" {...register('tags')} placeholder="e.g. mindfulness, productivity, relationships"/>
            </div>

        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
                <Link href="/dashboard/coach/blog" className="text-sm font-medium hover:underline">Cancel</Link>
            </div>
            <div className="flex items-center space-x-4">
                <Button type="submit" variant="outline" onClick={() => setValue('status', 'draft')} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Draft
                </Button>
                <Button type="submit" onClick={() => setValue('status', 'pending_approval')} disabled={isSubmitting}>
                     {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    Submit for Approval
                </Button>
            </div>
        </CardFooter>
      </form>
    </Card>
  );
}

function insertMarkdown(textarea: HTMLTextAreaElement, prefix: string, suffix: string, setValue: Function) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const newText = textarea.value.substring(0, start) + prefix + selectedText + suffix + textarea.value.substring(end);
    
    setValue('content', newText, { shouldValidate: true, shouldDirty: true });
    
    // This timeout is necessary to allow React to re-render the textarea before we set the selection
    setTimeout(() => {
        textarea.focus();
        const newCursorPosition = start + prefix.length;
        textarea.setSelectionRange(newCursorPosition, newCursorPosition + selectedText.length);
    }, 0);
}
