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
import { Loader2, FileEdit, UploadCloud, Save, FileText, AlertCircle, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation'; // Don't need useParams here, postId comes from props
import { useAuth } from '@/lib/auth';
import { updateFirestoreBlogPost } from '@/lib/firestore'; // getFirestoreBlogPost will be used by server component
import type { BlogPost, FirestoreBlogPost } from '@/types';
import { AlertCircle as AlertCircleIcon } from 'lucide-react';
import Link from 'next/link';

import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import ReactMarkdown from 'react-markdown';

const blogPostEditSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters.'),
  content: z.string().min(50, 'Content must be at least 50 characters.'),
  excerpt: z.string().min(10, 'Excerpt must be at least 10 characters.').max(200, 'Excerpt must be at most 200 characters.').optional(),
  tags: z.string().optional(), // Comma-separated
  featuredImageUrl: z.string().url('Invalid URL for featured image.').optional().or(z.literal('')),
  status: z.enum(['draft', 'pending_approval', 'published', 'rejected']),
});

type BlogPostEditFormData = z.infer<typeof blogPostEditSchema>;

interface EditBlogPostFormProps {
  initialPostData: BlogPost | null;
  postId: string;
}

export default function EditBlogPostForm({ initialPostData, postId }: EditBlogPostFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  // isFetchingPost is removed as initial data is passed via props
  const [post, setPost] = useState<BlogPost | null>(initialPostData);
  const [uploading, setUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | undefined>(initialPostData?.featuredImageUrl || '');
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  const { toast } = useToast();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  // postId comes from props

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
      title: initialPostData?.title || '',
      content: initialPostData?.content || '',
      excerpt: initialPostData?.excerpt || '',
      tags: initialPostData?.tags?.join(', ') || '',
      featuredImageUrl: initialPostData?.featuredImageUrl || '',
      status: initialPostData?.status || 'draft',
    }
  });

  const watchedContent = watch("content", initialPostData?.content || "");

  // Effect to reset form if initialPostData changes or on initial load
  useEffect(() => {
    if (initialPostData) {
      setPost(initialPostData);
      reset({
        title: initialPostData.title,
        content: initialPostData.content,
        excerpt: initialPostData.excerpt || '',
        tags: initialPostData.tags?.join(', ') || '',
        featuredImageUrl: initialPostData.featuredImageUrl || '',
        status: initialPostData.status,
      });
      setUploadedImageUrl(initialPostData.featuredImageUrl || '');
    } else {
      // Handle case where initialPostData is null (e.g. post not found by server component)
      toast({ title: "Post Not Found", description: "The blog post you are trying to edit does not exist or couldn't be loaded.", variant: "destructive" });
      // Optionally redirect, or rely on server component's notFound()
    }
  }, [initialPostData, reset, toast]);
  

  // Auth check effect - redirect if not logged in or not the author
  useEffect(() => {
    if (authLoading) return; // Wait for auth state to load

    if (!user) {
      toast({ title: "Authentication Required", description: "Please log in to edit a blog post.", variant: "destructive" });
      router.push('/login');
      return;
    }

    if (initialPostData && initialPostData.authorId !== user.id) {
      toast({ title: "Unauthorized", description: "You can only edit your own blog posts.", variant: "destructive" });
      router.push('/dashboard/coach/blog');
    }
  }, [user, authLoading, initialPostData, router, toast]);


  function insertMarkdown(prefix: string, suffix: string) {
    const textarea = contentRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const newText =
      textarea.value.substring(0, start) +
      prefix +
      selectedText +
      suffix +
      textarea.value.substring(end);
    setValue('content', newText, { shouldValidate: true, shouldDirty: true });
    textarea.focus();
    setTimeout(() => {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  }

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      if (!user) throw new Error("User not authenticated for upload");
      const userId = user.id || user.uid; // Ensure user.id is preferred if available
      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `blog-images/${userId}/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on(
        'state_changed',
        () => {},
        (error) => { setUploading(false); throw error; },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setUploadedImageUrl(downloadURL);
          setValue('featuredImageUrl', downloadURL, { shouldValidate: true });
          toast({ title: "Image uploaded", description: "Featured image URL has been updated" });
          setUploading(false);
        }
      );
    } catch (error) {
      console.error("Image upload error:", error);
      toast({ title: "Upload Failed", description: String(error.message || "Could not upload image, try again."), variant: "destructive" });
      setUploading(false);
    }
  }

  const onSubmit: SubmitHandler<BlogPostEditFormData> = async (data) => {
    if (!user || !post) {
      toast({ title: "Error", description: "User not authenticated or post data missing.", variant: "destructive" });
      return;
    }
    if (post.authorId !== user.id) {
       toast({ title: "Unauthorized", description: "You cannot edit this post.", variant: "destructive" });
       return;
    }

    setIsLoading(true);
    const updateData: Partial<Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'authorId' | 'authorName'>> = {
      title: data.title,
      content: data.content,
      excerpt: data.excerpt,
      tags: data.tags?.split(',').map((tag) => tag.trim()).filter(Boolean) || [],
      featuredImageUrl: data.featuredImageUrl,
      status: data.status,
      // updatedAt will be handled by Firestore server timestamp or cloud function ideally
    };

    try {
      await updateFirestoreBlogPost(postId, updateData); // postId from props
      toast({
        title: "Blog Post Updated!",
        description: `Your post "${data.title}" has been updated and saved as ${data.status}.`,
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
    setValue('status', newStatus);
    handleSubmit(onSubmit)();
  };

  // Initial loading for auth state
  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Verifying authentication...</span>
      </div>
    );
  }

  // If initialPostData is null (meaning server couldn't find it)
  if (!initialPostData) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <AlertCircleIcon className="mr-3 h-7 w-7 text-destructive" /> Post Not Found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>The blog post you are trying to edit could not be found.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/dashboard/coach/blog">Back to My Blog Posts</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  // If post is null after initial setup (should ideally be covered by !initialPostData)
  // or if user is not author (though redirection should have happened)
  if (!post || (user && post.authorId !== user.id)) {
     return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center">
            <AlertCircleIcon className="mr-3 h-7 w-7 text-destructive" /> Access Denied or Post Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>You do not have permission to edit this post, or an error occurred loading the post data.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/dashboard/coach/blog">Back to My Blog Posts</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return( <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
          <FileEdit className="mr-3 h-7 w-7 text-primary" /> Edit Blog Post: {initialPostData.title}
        </CardTitle>
        <CardDescription>Modify your article and save the changes. Markdown preview updates live.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="title">Post Title</Label>
          <Input
            id="title"
            {...register('title')}
            placeholder="Your engaging blog post title"
            className={errors.title ? 'border-destructive' : ''}
          />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <div className="space-y-2">
            <Label htmlFor="content">Content (Markdown)</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              <Button type="button" variant="outline" size="sm" onClick={() => insertMarkdown('**', '**')}>Bold</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => insertMarkdown('_', '_')}>Italic</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => insertMarkdown('### ', '')}>H3</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => insertMarkdown('\n- ', '')}>List</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => insertMarkdown('[', '](url)')}>Link</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => insertMarkdown('`', '`')}>Code</Button>
            </div>
            <Textarea
              id="content"
              {...register('content')}
              rows={15}
              placeholder="Write your amazing blog post here... Supports Markdown."
              className={`font-mono text-sm ${errors.content ? 'border-destructive' : ''}`}
              ref={(e) => {
                register('content').ref(e);
                contentRef.current = e;
              }}
            />
            {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="markdown-preview">
              <Eye className="inline-block mr-1 h-4 w-4" />
              Live Preview
            </Label>
            <div
              id="markdown-preview"
              className="prose prose-sm dark:prose-invert max-w-none p-4 border rounded-md min-h-[300px] h-full overflow-y-auto bg-muted/30"
              style={{ minHeight: contentRef.current ? `${contentRef.current.offsetHeight}px` : '300px' }}
            >
              <ReactMarkdown>{watchedContent || "Start typing to see a preview..."}</ReactMarkdown>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="excerpt">Excerpt (Short summary)</Label>
          <Textarea
            id="excerpt"
            {...register('excerpt')}
            rows={3}
            placeholder="A brief summary for previews (max 200 characters)."
            className={errors.excerpt ? 'border-destructive' : ''}
          />
          {errors.excerpt && <p className="text-sm text-destructive">{errors.excerpt.message}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (Comma-separated)</Label>
            <Input id="tags" {...register('tags')} placeholder="e.g., mindfulness, career, wellness" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="featuredImageUpload">Upload Featured Image (Optional)</Label>
            <input
              id="featuredImageUpload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
            {uploading && <p className="text-sm text-muted-foreground">Uploading image...</p>}
            {(uploadedImageUrl || watch('featuredImageUrl')) && (
              <div className="mt-2">
                <p className="text-sm font-medium">Current/Uploaded Image:</p>
                <img src={uploadedImageUrl || watch('featuredImageUrl')} alt="Featured Image Preview" className="mt-1 max-h-40 rounded border"/>
              </div>
            )}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="featuredImageUrlManual">Or Enter Featured Image URL</Label>
            <Input id="featuredImageUrlManual" {...register('featuredImageUrl')} placeholder="https://example.com/image.png" className={errors.featuredImageUrl ? 'border-destructive' : ''} />
            {errors.featuredImageUrl && <p className="text-sm text-destructive">{errors.featuredImageUrl.message}</p>}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row sm:justify-between gap-3 pt-6 border-t">
        <Button
            type="button"
            variant="outline"
            onClick={() => handleFormSubmit('draft')}
            disabled={isLoading || uploading}
            className="flex-1 sm:flex-none"
        >
            {isLoading && watch('status') === 'draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Save Draft
        </Button>
        <Button
            type="button"
            variant="secondary"
            onClick={() => handleFormSubmit('pending_approval')}
            disabled={isLoading || uploading}
            className="flex-1 sm:flex-none"
        >
            {isLoading && watch('status') === 'pending_approval' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Submit for Approval
        </Button>
      </CardFooter>
    </Card>
  );
}
