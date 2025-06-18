
import Image from 'next/image';
import Link from 'next/link';
import type { BlogPost } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, UserCircle, Edit3, Eye } from 'lucide-react'; // Added Eye icon
import { format } from 'date-fns';

interface BlogPostCardProps {
  post: BlogPost;
  showEditButton?: boolean; // For coach dashboard
}

export function BlogPostCard({ post, showEditButton = false }: BlogPostCardProps) {
  return (
    <Card className="flex flex-col overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
      {post.featuredImageUrl && (
        <CardHeader className="p-0 relative">
          <Link
            href={`/blog/${post.slug}`}
            aria-label={`Read more about ${post.title}`}
          >
            <Image
              src={post.featuredImageUrl}
              alt={`Featured image for blog post titled: ${post.title}`}
              width={400}
              height={200}
              className="object-cover w-full h-48"
              data-ai-hint={post.dataAiHint as string || "article topic"}
            />
          </Link>
        </CardHeader>
      )}
      <CardContent className="p-6 flex-grow">
        <div className="mb-2">
          {post.tags?.slice(0, 2).map(tag => (
            <Badge key={tag} variant="secondary" className="mr-2 mb-1 text-xs">{tag}</Badge>
          ))}
        </div>
        <CardTitle className="text-xl font-semibold mb-2">
          <Link
            href={`/blog/${post.slug}`}
            className="hover:text-primary transition-colors"
          >
            {post.title}
          </Link>
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground line-clamp-3 mb-3">
          {post.excerpt || post.content?.substring(0, 100) + '...'}
        </CardDescription>
        <div className="flex items-center text-xs text-muted-foreground space-x-3">
          <div className="flex items-center">
            <UserCircle className="h-4 w-4 mr-1" />
            <span>{post.authorName}</span>
          </div>
          <div className="flex items-center">
            <CalendarDays className="h-4 w-4 mr-1" />
            <span>{format(new Date(post.createdAt), 'MMM d, yyyy')}</span>
          </div>
        </div>
         {post.status !== 'published' && (
            <Badge 
              variant={post.status === 'pending_approval' ? 'secondary' : (post.status === 'draft' ? 'outline' : 'destructive')} 
              className="mt-3 text-xs"
            >
              Status: {post.status.replace('_', ' ').replace(/ \w/g, l => l.toUpperCase())}
            </Badge>
          )}
      </CardContent>
      <CardFooter className="p-6 border-t">
        <div className="flex justify-between w-full items-center">
          <Button asChild variant="outline" size="sm">
            <Link href={`/blog/${post.slug}`}>
              <>
                <Eye className="mr-2 h-4 w-4" /> Read More
              </>
            </Link>
          </Button>
          {showEditButton && (
             <Button asChild variant="ghost" size="sm">
                <Link href={`/dashboard/coach/blog/edit/${post.slug}`}>
                  <>
                    <Edit3 className="mr-2 h-4 w-4" /> Edit
                  </>
                </Link>
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
