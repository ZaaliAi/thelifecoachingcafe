import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarDays, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

import {
  getFirestoreBlogPostBySlug,
  getCoachById,
  getAllPublishedBlogPostSlugs, // ✅ Corrected name
} from '@/lib/firestore';

export const revalidate = 3600; // Regenerates page every hour

export async function generateStaticParams() {
  const slugs = await getAllPublishedBlogPostSlugs(); // ✅ Use correct function
  return slugs.map((slug) => ({ slug }));
}

interface PageProps {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await getFirestoreBlogPostBySlug(params.slug);

  if (!post) {
    return {
      title: 'Blog Post Not Found',
      description: 'This blog post could not be found.',
    };
  }

  const title = `${post.title} | The Life Coaching Cafe Blog`;
  const plainText = post.content.replace(/<[^>]+>/g, '').replace(/\n/g, ' ');
  const description = plainText.substring(0, 155).trim() + '...';
  const imageUrl = post.featuredImageUrl || '/preview.jpg';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [imageUrl],
      type: 'article',
      publishedTime: new Date(post.createdAt).toISOString(),
      authors: [post.authorName],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default async function BlogPostPage({ params, searchParams }: PageProps) {
  const slug = params.slug;
  const isPreview = searchParams.preview === 'true';

  const post = await getFirestoreBlogPostBySlug(slug);
  if (!post || (post.status !== 'published' && !isPreview)) {
    notFound();
  }

  const author = post.authorId ? await getCoachById(post.authorId) : null;

  return (
    <article className="max-w-3xl mx-auto py-8 space-y-8">
      <header className="space-y-4">
        <Button variant="outline" asChild className="mb-4">
          <Link href="/blog">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Blog
          </Link>
        </Button>

        {post.featuredImageUrl && (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-lg">
            <Image
              src={post.featuredImageUrl}
              alt={`Featured image for blog post titled: ${post.title}`}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {post.tags?.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
          {post.title}
        </h1>

        <div className="flex items-center space-x-4 text-muted-foreground">
          {author?.profileImageUrl && (
            <Avatar className="h-8 w-8 mr-2">
              <AvatarImage src={author.profileImageUrl} alt={author.name || 'Author'} />
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

      {isPreview && post.status !== 'published' && (
        <div className="p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800">
          <p className="font-bold">Preview Mode</p>
          <p>
            Current status: <Badge variant="outline">{post.status}</Badge>
          </p>
        </div>
      )}

      <div className="prose prose-lg dark:prose-invert max-w-none">
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </div>

      {author && (
        <footer className="pt-8 border-t">
          <h3 className="text-xl font-semibold mb-4">About the Author</h3>
          <div className="flex items-start space-x-4 p-4 bg-muted/50 rounded-lg">
            {author.profileImageUrl && (
              <Avatar className="h-16 w-16">
                <AvatarImage src={author.profileImageUrl} alt={author.name} />
                <AvatarFallback>{author.name.charAt(0)}</AvatarFallback>
              </Avatar>
            )}
            <div>
              <h4 className="text-lg font-medium">{author.name}</h4>
              <p className="text-sm text-muted-foreground line-clamp-3">{author.bio}</p>
              <Button variant="link" asChild className="p-0 h-auto mt-1">
                <Link href={`/coach/${author.id}`}>View Profile</Link>
              </Button>
            </div>
          </div>
        </footer>
      )}

      <script type="application/ld+json">
        {`
          {
            "@context": "https://schema.org",
            "@type": "Article",
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": "https://thelifecoachingcafe.com/blog/${post.slug}"
            },
            "headline": "${post.title.replace(/"/g, '\\"')}",
            "description": "${post.content.replace(/<[^>]+>/g, '').replace(/\n/g, ' ').replace(/"/g, '\\"').substring(0, 160).trim() + '...'}",
            "image": "${post.featuredImageUrl && post.featuredImageUrl.startsWith('http') ? post.featuredImageUrl : 'https://thelifecoachingcafe.com' + (post.featuredImageUrl || '/preview.jpg')}",
            "author": {
              "@type": "Person",
              "name": "${post.authorName.replace(/"/g, '\\"')}"
            },
            "publisher": {
              "@type": "Organisation",
              "name": "The Life Coaching Cafe",
              "logo": {
                "@type": "ImageObject",
                "url": "https://thelifecoachingcafe.com/preview.jpg"
              }
            },
            "datePublished": "${new Date(post.createdAt).toISOString()}",
            "dateModified": "${new Date(post.updatedAt || post.createdAt).toISOString()}"
          }
        `}
      </script>
      <script type="application/ld+json">
        {`
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://thelifecoachingcafe.com"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "Blog",
                "item": "https://thelifecoachingcafe.com/blog"
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": "${post.title.replace(/"/g, '\\"')}",
                "item": "https://thelifecoachingcafe.com/blog/${post.slug}"
              }
            ]
          }
        `}
      </script>
    </article>
  );
}

