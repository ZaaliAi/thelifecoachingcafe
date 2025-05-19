
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
  if (post && post.status !== 'published') return undefined; // Only show published posts
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
          <Link href="/blog" legacyBehavior><ArrowLeft className="mr-2 h-4 w-4" /> Back to Life Coaching Blog Articles</Link>
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
        {/* In a real app, use a Markdown renderer here for post.content */}
        <p>{post.content}</p>
        {/* Example content below, remove if not needed */}
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
        <h2>A Subheading for More Detail</h2>
        <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
        <figure>
            <Image src="https://placehold.co/700x400.png" alt="Illustrative image for blog post" width={700} height={400} className="rounded-md shadow-md" data-ai-hint="concept illustration" />
            <figcaption className="text-center text-sm text-muted-foreground mt-2">An illustrative image related to the topic on personal development.</figcaption>
        </figure>
        <p>Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.</p>
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
