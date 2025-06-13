'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarDays, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import type { BlogPost, Coach } from '@/types';
import { notFound, useParams, useSearchParams } from 'next/navigation';
import { getFirestoreBlogPostBySlug, getCoachById } from '@/lib/firestore';
import ReactMarkdown from 'react-markdown';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

/**
 * Fetches a blog post by its slug.
 * This function is now simplified to rely entirely on Firestore Security Rules for access control.
 * - Public users can only fetch posts where `status === 'published'`.
 * - Admins can fetch any post.
 * - If the rules deny access, Firestore will throw a 'permission-denied' error.
 */
async function getBlogPost(slug: string): Promise<BlogPost | undefined> {
  const post = await getFirestoreBlogPostBySlug(slug);
  return post ?? undefined; // Returns the post if found, otherwise undefined.
}

async function getAuthorDetails(authorId: string): Promise<Coach | null> {
  return getCoachById(authorId);
}

function BlogPostSkeleton() {
  return (
    <article className="max-w-3xl mx-auto py-8 space-y-8">
      <header className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="relative w-full aspect-video rounded-lg" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="flex items-center space-x-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-6 w-1/4" />
        </div>
      </header>
      <div className="prose prose-lg max-w-none space-y-4">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-5/6" />
        <Skeleton className="h-6 w-full" />
      </div>
    </article>
  )
}

export default function BlogPostPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const [post, setPost] = useState<BlogPost | null>(null);
  const [author, setAuthor] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const isPreview = searchParams.get('preview') === 'true';

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError("Blog post slug not found in URL.");
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // The getBlogPost function now relies solely on Firestore rules for permission.
        const postData = await getBlogPost(slug);
        
        if (!postData) {
          // This happens if the post doesn't exist OR if rules denied access,
          // which Firestore often reports as "not found" for non-authenticated users.
          setError("Blog post not found or you don't have permission to view it.");
          notFound();
          return;
        }
        
        setPost(postData);
        
        if (postData.authorId) {
          const authorData = await getAuthorDetails(postData.authorId);
          setAuthor(authorData);
        }
      } catch (e: any) {
        console.error("Error fetching blog post:", e);
        if (e.code === 'permission-denied') {
           setError("Permission denied. To view a draft or pending post, please ensure you are logged in as an admin.");
        } else {
           setError("An error occurred while loading the blog post.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug]);

  if (loading) {
    return <BlogPostSkeleton />;
  }

  if (error) {
     return (
      <div className="max-w-3xl mx-auto py-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-red-500">{error}</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/blog">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Blog
          </Link>
        </Button>
      </div>
    );
  }

  if (!post) {
    return notFound();
  }

  return (
    <article className="max-w-3xl mx-auto py-8 space-y-8">
      <header className="space-y-4">
        <Button variant="outline" asChild className="mb-4">
          <Link href="/blog">
            <>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Life Coaching Blog Articles
            </>
          </Link>
        </Button>

        {post.featuredImageUrl && (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-lg">
            <Image
              src={post.featuredImageUrl}
              alt={post.title}
              fill
              className="object-cover"
              priority
              data-ai-hint={post.dataAiHint as string || "article theme"}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {post.tags?.map(tag => (
            <Badge key={tag} variant="secondary">{tag}</Badge>
          ))}
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">{post.title}</h1>

        <div className="flex items-center space-x-4 text-muted-foreground">
          {author && author.profileImageUrl && (
            <Avatar className="h-8 w-8 mr-2">
              <AvatarImage src={author.profileImageUrl} alt={author.name || "Author profile picture"} data-ai-hint={author.dataAiHint as string || "person face"} />
              <AvatarFallback>{author.name?.charAt(0) || 'A'}</AvatarFallback>
            </Avatar>
          )}
          <span>{post.authorName}</span>
          <div className="flex items-center">
            <CalendarDays className="h-5 w-5 mr-1" />
            <span>{format(new Date(post.createdAt), 'MMMM d, yyyy')}</span>
          </div>
        </div>
      </header>
      
      {/* The isPreview flag is still useful to show a banner */}
      {isPreview && post.status !== 'published' && (
        <div className="p-4 bg-yellow-100 dark:bg-yellow-900/50 border-l-4 border-yellow-500 text-yellow-800 dark:text-yellow-200">
            <p className="font-bold">Preview Mode</p>
            <p>You are viewing a preview of this blog post. The current status is: <Badge variant="outline">{post.status}</Badge></p>
        </div>
      )}


      <div className="prose prose-lg dark:prose-invert max-w-none text-foreground/90 leading-relaxed">
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </div>

      <footer className="pt-8 border-t">
        <h3 className="text-xl font-semibold mb-4">About the Author: {author?.name || post.authorName}</h3>
        {author ? (
          <div className="flex items-start space-x-4 p-4 bg-muted/50 rounded-lg">
            {author.profileImageUrl && (
              <Avatar className="h-16 w-16">
                <AvatarImage src={author.profileImageUrl} alt={`${author.name} - professional life coach`} data-ai-hint={author.dataAiHint as string || "author portrait"} />
                <AvatarFallback>{author.name.charAt(0)}</AvatarFallback>
              </Avatar>
            )}
            <div>
              <h4 className="text-lg font-medium">{author.name}</h4>
              <p className="text-sm text-muted-foreground line-clamp-3">{author.bio}</p>
              <Button variant="link" asChild className="p-0 h-auto mt-1">
                <Link href={`/coach/${author.id}`}>View Profile of this Life Coach</Link>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">Author information not available.</p>
        )}
      </footer>
    </article>
  );
}
