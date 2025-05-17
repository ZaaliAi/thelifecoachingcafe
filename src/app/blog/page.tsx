
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BlogPostCard } from '@/components/BlogPostCard';
import { Search, Filter } from 'lucide-react';
import type { BlogPost } from '@/types';
import { getPublishedBlogPosts } from '@/lib/firestore'; // Assuming this fetches all published posts

const ALL_CATEGORIES_VALUE = "_all_";

async function getBlogPostsWithFilter(filters?: { category?: string, searchTerm?: string }): Promise<BlogPost[]> {
  let posts = await getPublishedBlogPosts(); // Fetch all published posts first

  if (filters?.category && filters.category !== ALL_CATEGORIES_VALUE) {
    posts = posts.filter(post => post.tags?.includes(filters.category!));
  }
  if (filters?.searchTerm) {
    const lowerSearchTerm = filters.searchTerm.toLowerCase();
    posts = posts.filter(post => 
      post.title.toLowerCase().includes(lowerSearchTerm) ||
      post.content.toLowerCase().includes(lowerSearchTerm) ||
      post.authorName.toLowerCase().includes(lowerSearchTerm) ||
      post.tags?.some(tag => tag.toLowerCase().includes(lowerSearchTerm))
    );
  }
  return posts;
}

async function getAllCategories(): Promise<string[]> {
    const posts = await getPublishedBlogPosts(); // Consider fetching only tags for efficiency if possible
    const categories = Array.from(new Set(posts.flatMap(post => post.tags || []).filter(Boolean)));
    return categories;
}


export default async function BlogPage({ searchParams }: { searchParams?: { category?: string, search?: string } }) {
  const rawCategory = searchParams?.category;
  const searchTerm = searchParams?.search;
  const effectiveCategory = (rawCategory === ALL_CATEGORIES_VALUE || !rawCategory) ? undefined : rawCategory;

  const posts = await getBlogPostsWithFilter({ category: effectiveCategory, searchTerm });
  const categories = await getAllCategories();

  return (
    <div className="space-y-12">
      <section className="text-center py-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Life Coaching Cafe Blog</h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto">
          Explore life coaching blog articles, tips from professional life coaches, and stories on personal development, mindset, and achieving your goals.
        </p>
      </section>

      <section className="mb-8 p-6 bg-muted/50 rounded-lg shadow-sm">
        <form method="GET" action="/blog" className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label htmlFor="search" className="block text-sm font-medium text-foreground mb-1">Search Blog Articles</label>
            <div className="relative">
              <Input 
                type="search" 
                name="search"
                id="search" 
                placeholder="Keywords (e.g., mindset, confidence)..." 
                defaultValue={searchTerm}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            </div>
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-foreground mb-1">Filter by Coaching Specialty</label>
            <Select name="category" defaultValue={rawCategory || ALL_CATEGORIES_VALUE}>
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="All Coaching Specialties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES_VALUE}>All Coaching Specialties</SelectItem>
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
          <p className="text-xl text-muted-foreground">No life coaching blog articles found matching your criteria.</p>
           <p className="text-muted-foreground mt-2">Try different keywords or browse all categories.</p>
        </section>
      )}

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

export const dynamic = 'force-dynamic';
