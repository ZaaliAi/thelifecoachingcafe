import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarDays, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import type { BlogPost, Coach } from '@/types';
import { notFound } from 'next/navigation';
import { getFirestoreBlogPostBySlug, getAllPublishedBlogPostSlugs, getCoachById } from '@/lib/firestore';

async function getBlogPost(slug: string): Promise<BlogPost | undefined> {
  const post = await getFirestoreBlogPostBySlug(slug);
  if (post && post.status !== 'published') return undefined;
  return post;
}

async function getAuthorDetails(authorId: string): Promise<Coach | null> {
  return getCoachById(authorId);
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getBlogPost(params.slug);

  if (!post) {
    notFound();
  }

  const author = await getAuthorDetails(post.authorId);

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

      <div className="prose prose-lg dark:prose-invert max-w-none text-foreground/90 leading-relaxed">
        {post.content.split('\n').map((para, i) => (
          <p key={i} className="mb-6">{para}</p>
        ))}
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

export async function generateStaticParams() {
  const slugs = await getAllPublishedBlogPostSlugs();
  return slugs.map(slug => ({ slug }));
}
