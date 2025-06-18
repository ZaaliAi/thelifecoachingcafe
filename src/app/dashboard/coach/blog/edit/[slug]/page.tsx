
import { getFirestoreBlogPostBySlug } from '@/lib/firestore';
import EditBlogPostForm from '@/components/dashboard/EditBlogPostForm';
import type { BlogPost } from '@/types';
import { notFound } from 'next/navigation';

interface PageProps {
  params: { slug: string };
}

export default async function EditBlogPostServerPage({ params }: PageProps) {
  const { slug } = params;
  let postData: BlogPost | null = null;

  try {
    const fetchedPost = await getFirestoreBlogPostBySlug(slug);
    if (fetchedPost) {
      postData = fetchedPost as BlogPost;
    }
  } catch (error) {
    console.error(`Failed to fetch blog post with slug ${slug} from Firestore:`, error);
  }

  if (!postData) {
     notFound(); 
  }

  return <EditBlogPostForm initialPostData={postData} postId={postData.id} />;
}
