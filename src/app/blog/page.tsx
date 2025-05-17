
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BlogPostCard } from '@/components/BlogPostCard';
import { mockBlogPosts } from '@/data/mock';
import { Search, Filter } from 'lucide-react';
import type { BlogPost } from '@/types';

const ALL_CATEGORIES_VALUE = "_all_";

// This would be a server component fetching posts in a real app
async function getBlogPosts(filters?: { category?: string, searchTerm?: string }): Promise<BlogPost[]> {
  // Simulate fetching and filtering
  await new Promise(resolve => setTimeout(resolve, 200)); // Simulate delay
  let posts = mockBlogPosts.filter(p => p.status === 'published');
  if (filters?.category && filters.category !== ALL_CATEGORIES_VALUE) { // Ensure not to filter by the special value
    posts = posts.filter(post => post.tags?.includes(filters.category!));
  }
  if (filters?.searchTerm) {
    posts = posts.filter(post => 
      post.title.toLowerCase().includes(filters.searchTerm!.toLowerCase()) ||
      post.content.toLowerCase().includes(filters.searchTerm!.toLowerCase())
    );
  }
  return posts;
}

const categories = Array.from(new Set(mockBlogPosts.flatMap(post => post.tags || [])));

export default async function BlogPage({ searchParams }: { searchParams?: { category?: string, search?: string } }) {
  const rawCategory = searchParams?.category;
  const searchTerm = searchParams?.search;

  // If category is "_all_" or undefined/empty, then treat as no category filter for getBlogPosts
  const effectiveCategory = (rawCategory === ALL_CATEGORIES_VALUE || !rawCategory) ? undefined : rawCategory;

  const posts = await getBlogPosts({ category: effectiveCategory, searchTerm });

  return (
    <div className="space-y-12">
      <section className="text-center py-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">CoachConnect Blog</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Insights, tips, and stories from our community of expert life coaches.
        </p>
      </section>

      {/* Filters and Search - Would be a client component form in a real app for interactivity */}
      <section className="mb-8 p-6 bg-muted/50 rounded-lg shadow-sm">
        <form method="GET" action="/blog" className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-foreground mb-1">Search Posts</label>
            <div className="relative">
              <Input 
                type="search" 
                name="search"
                id="search" 
                placeholder="Keywords..." 
                defaultValue={searchTerm}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-foreground mb-1">Filter by Category</label>
            <Select name="category" defaultValue={rawCategory || ALL_CATEGORIES_VALUE}>
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES_VALUE}>All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground">
            <Filter className="mr-2 h-4 w-4" /> Apply Filters
          </Button>
        </form>
      </section>

      {posts.length > 0 ? (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <BlogPostCard key={post.id} post={post} />
          ))}
        </section>
      ) : (
        <section className="text-center py-12">
          <p className="text-xl text-muted-foreground">No blog posts found matching your criteria.</p>
        </section>
      )}

      {/* Pagination Placeholder - Would require more logic */}
      {posts.length > 0 && (
        <section className="mt-12 flex justify-center">
          <div className="flex gap-2">
            <Button variant="outline" disabled>Previous</Button>
            <Button variant="outline">Next</Button>
          </div>
        </section>
      )}
    </div>
  );
}

export const dynamic = 'force-dynamic'; // Ensure searchParams are re-evaluated
