import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarDays, ArrowLeft, Info } from 'lucide-react';
import { format } from 'date-fns';
import type { BlogPost, Coach } from '@/types';
import { notFound } from 'next/navigation';
import { getFirestoreBlogPostBySlug, getCoachById } from '@/lib/firestore';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Fetches a blog post by slug, regardless of its status, for admin preview.
async function getBlogPostForAdminPreview(slug: string): Promise<BlogPost | undefined> {
  const post = await getFirestoreBlogPostBySlug(slug);
  // Admin should be able to view any post if the slug exists
  return post;
}

async function getAuthorDetails(authorId: string): Promise<Coach | null> {
  return getCoachById(authorId);
}

export default async function AdminBlogPostPreviewPage({ params }: { params: { slug: string } }) {
  const post = await getBlogPostForAdminPreview(params.slug);

  if (!post) {
    notFound(); // Or a more admin-friendly "post not found" message
  }

  const author = await getAuthorDetails(post.authorId);

  // Helper to format status nicely
  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\w/g, l => l.toUpperCase());
  };

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      <Card className="mb-6 border-primary/40 bg-primary/10">
        <CardHeader>
          <CardTitle className="text-lg text-primary flex items-center">
            <Info className="mr-2 h-5 w-5" />
            Admin Preview Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="text-primary/90">
          <div>
            You are viewing this blog post in admin preview mode. The current status is:
            <Badge variant={post.status === 'published' ? 'default' : 'secondary'} className="ml-2">
              {formatStatus(post.status)}
            </Badge>
          </div>
          {post.status !== 'published' && (
            <div className="text-sm mt-1">This post is not yet visible to the public.</div>
          )}
        </CardContent>
      </Card>

      <header className="space-y-4">
        <Button variant="outline" asChild className="mb-4">
          <Link href="/dashboard/admin/blogs">
            <>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Manage Blog Submissions
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
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </div>

      {/* <footer className="pt-8 border-t">
        <h3 className="text-xl font-semibold mb-4">About the Author: {author?.name || post.authorName}</h3>
        {author ? (
          <div className="flex items-start space-x-4 p-4 bg-muted/50 rounded-lg">
            {author.profileImageUrl && (
              <Avatar className="h-16 w-16">
                <AvatarImage src={author.profileImageUrl} alt={\`\${author.name} - professional life coach\`} data-ai-hint={author.dataAiHint as string || "author portrait"} />
                <AvatarFallback>{author.name?.charAt(0) || 'A'}</AvatarFallback>
              </Avatar>
            )}
            <div>
              <h4 className="text-lg font-medium">{author.name}</h4>
              <p className="text-sm text-muted-foreground line-clamp-3">{author.bio}</p>
              <Button variant="link" asChild className="p-0 h-auto mt-1">
                <Link href={\`/coach/\${author.id}\`}>View Profile of this Life Coach</Link>
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">Author information not available.</p>
        )}
      </footer> */}
    </div>
  );
}
