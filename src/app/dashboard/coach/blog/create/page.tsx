"use client";

import { useState, useRef, ChangeEvent } from 'react';
import { useForm, type SubmitHandler, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, PlusCircle, FileText, Save, Eye, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { createFirestoreBlogPost } from '@/lib/firestore';

import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from '@/lib/firebase';

import ReactMarkdown from 'react-markdown';

const blogPostSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters.'),
  content: z.string().min(50, 'Content must be at least 50 characters.'),
  excerpt: z.string().min(10, 'Excerpt must be at least 10 characters.').max(200, 'Excerpt must be at most 200 characters.').optional(),
  tags: z.string().optional(),
  featuredImageUrl: z.string().url('Invalid URL for featured image.').optional().or(z.literal('')),
  status: z.enum(['draft', 'pending_approval']),
});

type BlogPostFormData = z.infer<typeof blogPostSchema>;

export default function CreateBlogPostPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useAuth(); // Assuming useAuth provides the full user object including subscriptionTier

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    control,
    getValues
  } = useForm<BlogPostFormData>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: {
      status: 'draft',
      content: '',
    }
  });

  const watchedContent = useWatch({
    control,
    name: "content",
    defaultValue: ""
  });

  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  
  // Premium Feature Check
  if (user && user.subscriptionTier !== 'premium') {
    return (
      <Card className="shadow-lg max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center text-destructive">
            <AlertTriangle className="mr-3 h-7 w-7" />
            Premium Feature
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Creating blog posts is a premium feature. To share your insights with the community, please upgrade your plan.</p>
          <Button asChild className="mt-4">
            <a href="/pricing">View Pricing Plans</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  function insertMarkdown(prefix: string, suffix: string) {
    const textarea = contentRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    const newText = textarea.value.substring(0, start) +
      prefix + selectedText + suffix +
      textarea.value.substring(end);

    setValue('content', newText, { shouldValidate: true, shouldDirty: true });
    textarea.focus();
     setTimeout(() => {
        textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  }

  async function uploadImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!user) return reject(new Error("No logged-in user found."));
      const userId = user.id || user.uid;
      if (!userId) return reject(new Error("User ID not found."));

      const fileName = `${Date.now()}_${file.name}`;
      const storageRef = ref(storage, `blog-images/${userId}/${fileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        () => {},
        (error) => reject(error),
        () => getDownloadURL(uploadTask.snapshot.ref).then(resolve)
      );
    });
  }

  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setUploadedImageUrl(url);
      setValue('featuredImageUrl', url, { shouldValidate: true });
      toast({ title: "Image uploaded successfully" });
    } catch (error) {
      console.error("Image upload error:", error);
      toast({ title: "Upload Failed", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const onSubmit: SubmitHandler<BlogPostFormData> = async (data) => {
    // Redundant check, but good for defense-in-depth
    if (user?.subscriptionTier !== 'premium') {
      toast({ title: "Upgrade Required", description: "You must be a premium coach to create a blog post.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const blogPostPayload = {
        ...data,
        authorId: user.id || user.uid,
        authorName: user.name || user.email,
      };
      await createFirestoreBlogPost(blogPostPayload);
      toast({
        title: "Blog Post Submitted!",
        description: `Your post "${data.title}" has been ${data.status === 'draft' ? 'saved as a draft' : 'submitted for approval'}.`,
      });
      router.push('/dashboard/coach/blog');
    } catch (error) {
      console.error("Failed to submit blog post:", error);
      toast({ title: "Submission Failed", variant: "destructive" });
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
        <CardDescription>Share your knowledge and insights with the community. Markdown preview updates live.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Post Title</Label>
            <Input id="title" {...register('title')} placeholder="Your engaging blog post title" className={errors.title ? 'border-destructive' : ''} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-2">
              <Label htmlFor="content">Content (Markdown)</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                <Button type="button" variant="outline" size="sm" onClick={() => insertMarkdown('**', '**')}>Bold</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => insertMarkdown('_', '_')}>Italic</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => insertMarkdown('### ', '')}>H3</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => insertMarkdown('- ', '')}>List</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => insertMarkdown('[', '](url)')}>Link</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => insertMarkdown('`', '`')}>Code</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => insertMarkdown('> ', '')}>Quote</Button>
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
            <Textarea id="excerpt" {...register('excerpt')} rows={3} placeholder="A brief summary for previews (max 200 characters)." className={errors.excerpt ? 'border-destructive' : ''} />
            {errors.excerpt && <p className="text-sm text-destructive">{errors.excerpt.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="featuredImageUpload">Upload Featured Image (Optional)</Label>
              <input
                type="file"
                accept="image/*"
                id="featuredImageUpload"
                onChange={handleImageUpload}
                disabled={uploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
              />
              {uploading && <p className="text-sm text-muted-foreground">Uploading image...</p>}
              {uploadedImageUrl && (
                <div className="mt-2">
                  <p className="text-sm font-semibold">Preview:</p>
                  <img src={uploadedImageUrl} alt="Featured preview" className="max-h-48 rounded-md" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="featuredImageUrl">Or enter Featured Image URL (Optional)</Label>
              <Input
                id="featuredImageUrl"
                {...register('featuredImageUrl')}
                placeholder="https://example.com/image.png"
                className={errors.featuredImageUrl ? 'border-destructive' : ''}
              />
              {errors.featuredImageUrl && <p className="text-sm text-destructive">{errors.featuredImageUrl.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (Comma-separated)</Label>
              <Input id="tags" {...register('tags')} placeholder="e.g., mindfulness, career, wellness" />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-4 pt-6 border-t">
          <Button type="submit" onClick={() => setValue('status', 'draft')} variant="outline" disabled={isLoading || uploading}>
            {isLoading && getValues('status') === 'draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save as Draft
          </Button>
          <Button type="submit" onClick={() => setValue('status', 'pending_approval')} disabled={isLoading || uploading} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {isLoading && getValues('status') === 'pending_approval' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Submit for Approval
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
