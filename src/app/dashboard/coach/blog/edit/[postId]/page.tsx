import { getFirestoreBlogPost } from '@/lib/firestore';
import { mockBlogPosts } from '@/data/mock';
import EditBlogPostForm from '@/components/dashboard/EditBlogPostForm';
import type { BlogPost } from '@/types';
import { notFound } from 'next/navigation';
import { currentUser } from '@/lib/auth'; // For server-side auth check if needed

interface PageProps {
  params: { postId: string };
}

export default async function EditBlogPostServerPage({ params }: PageProps) {
  const { postId } = params;
  let postData: BlogPost | null = null;

  // Optional: Server-side check if user is logged in before even trying to fetch
  // const user = await currentUser(); // This is an example, your auth lib might differ
  // if (!user) {
  //   // Redirect or show an appropriate message if using server-side redirect
  //   // For static export, client-side auth in EditBlogPostForm will handle this primarily
  // }

  try {
    const fetchedPost = await getFirestoreBlogPost(postId);
    if (fetchedPost) {
      postData = fetchedPost as BlogPost; // Ensure type compatibility
    }
  } catch (error) {
    console.error(`Failed to fetch blog post ${postId} from Firestore:`, error);
    // Log error and proceed to try mock data
  }

  if (!postData) {
    console.log(`Post ${postId} not found in Firestore, trying mock data.`);
    const mockPost = mockBlogPosts.find(p => p.id === postId);
    if (mockPost) {
      postData = mockPost;
    } else {
      console.log(`Post ${postId} not found in mock data either.`);
    }
  }

  // The EditBlogPostForm component itself handles the case where initialPostData is null
  // and also handles the authorization check (if the logged-in user is the author).
  // So, we can pass postData (which might be null) directly.
  // If postData is null, the client component will show a "not found" message.
  
  // If you want to strictly enforce notFound at the server level for non-existent posts:
  if (!postData) {
     notFound(); // Renders the closest not-found.js or Next.js default
  }

  return <EditBlogPostForm initialPostData={postData} postId={postId} />;
}
