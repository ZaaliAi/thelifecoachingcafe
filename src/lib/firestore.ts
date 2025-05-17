// src/lib/firestore.ts
import { collection, doc, setDoc, getDoc, addDoc, Timestamp, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "./firebase"; // Import db from your firebase.ts

interface UserProfile {
  name: string;
  email: string;
  bio?: string; // Optional bio field
  role: 'user' | 'coach'; // Add a role field to differentiate users and coaches
  // Add any other fields you want for your user profile (e.g., specialties for coaches)
  specialties?: string[]; // Example: Add specialties for coaches
  availability?: string; // Example: Add availability for coaches
  rates?: string; // Example: Add rates for coaches
}

interface BlogPost {
   title: string;
   content: string;
   authorId: string; // Link to the user who wrote the post
   timestamp: Timestamp; // Use Firestore Timestamp type
   // Add any other fields you want for your blog posts (e.g., tags, status)
   tags?: string[]; // Example: Add tags
   status?: 'draft' | 'published'; // Example: Add status
}

async function createUserProfile(userId: string, profileData: UserProfile) {
  try {
    // Get a reference to the 'users' collection
    const usersCollection = collection(db, "users");

    // Create a document reference with the user's ID as the document ID
    const userDocRef = doc(usersCollection, userId);

    // Set the document data (create or overwrite)
    await setDoc(userDocRef, profileData);

    console.log("User profile created successfully for user:", userId);
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error; // Re-throw the error for handling in your application
  }
}

async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const usersCollection = collection(db, "users");
    const userDocRef = doc(usersCollection, userId);

    // Get the document snapshot
    const userDoc = await getDoc(userDocRef);

    // Check if the document exists
    if (userDoc.exists()) {
      console.log("User profile found for user:", userId);
      // Return the user profile data
      return userDoc.data() as UserProfile;
    } else {
      console.log("No user profile found for user:", userId);
      return null; // Return null if the document does not exist
    }
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
}

async function createBlogPost(postData: Omit<BlogPost, 'timestamp'>) {
  try {
    // Get a reference to the 'blogs' collection
    const blogsCollection = collection(db, "blogs");

    // Add a new document to the 'blogs' collection
    const newPostRef = await addDoc(blogsCollection, {
      ...postData,
      timestamp: Timestamp.now() // Add the server timestamp
    });

    console.log("Blog post created successfully with ID:", newPostRef.id);
    return newPostRef.id; // Return the ID of the newly created post
  } catch (error) {
    console.error("Error creating blog post:", error);
    throw error;
  }
}

async function getBlogPost(postId: string): Promise<BlogPost | null> {
  try {
    const blogsCollection = collection(db, "blogs");
    const postDocRef = doc(blogsCollection, postId);

    const postDoc = await getDoc(postDocRef);

    if (postDoc.exists()) {
      console.log("Blog post found with ID:", postId);
      // Return the blog post data, including the ID
      return { id: postDoc.id, ...postDoc.data() as BlogPost };
    } else {
      console.log("No blog post found with ID:", postId);
      return null;
    }
  } catch (error) {
    console.error("Error getting blog post:", error);
    throw error;
  }
}

async function getBlogPosts(limit = 10): Promise<BlogPost[]> {
  try {
    const blogsCollection = collection(db, "blogs");

    // Create a query to order by timestamp and limit the results
    const q = query(blogsCollection, orderBy("timestamp", "desc"), limit(limit)); // Order by timestamp descending

    // Get the documents based on the query
    const querySnapshot = await getDocs(q);

    const blogPosts: BlogPost[] = [];
    querySnapshot.forEach((doc) => {
      // Add each blog post's data (including ID) to the array
      blogPosts.push({ id: doc.id, ...doc.data() as BlogPost });
    });

    console.log(`Fetched ${blogPosts.length} blog posts.`);
    return blogPosts;
  } catch (error) {
    console.error("Error getting blog posts:", error);
    throw error;
  }
}

export { createUserProfile, getUserProfile, createBlogPost, getBlogPost, getBlogPosts };

