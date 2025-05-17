// src/lib/firestore.ts
import type { Timestamp } from "firebase/firestore";
import { collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs, serverTimestamp, limit as firestoreLimit } from "firebase/firestore";
import { db } from "./firebase"; // Import db from your firebase.ts

// Interface for User Profile data stored in Firestore
export interface UserProfile {
  id?: string; // UID from Firebase Auth, also document ID
  name: string;
  email: string;
  bio?: string;
  role: 'user' | 'coach' | 'admin';
  specialties?: string[]; // For coaches
  keywords?: string[]; // For coaches
  profileImageUrl?: string;
  certifications?: string[]; // For coaches
  location?: string;  // For coaches
  availability?: string; // Example: Add availability for coaches
  rates?: string; // Example: Add rates for coaches
  subscriptionTier?: 'free' | 'premium'; // For coaches
  websiteUrl?: string; // For coaches (premium)
  introVideoUrl?: string; // For coaches (premium)
  socialLinks?: { platform: string; url: string }[]; // For coaches (premium)
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// Interface for Blog Post data stored in Firestore
export interface FirestoreBlogPost {
   id?: string; // Document ID, assigned by Firestore or manually
   slug: string;
   title: string;
   content: string; // Markdown content
   excerpt?: string;
   authorId: string; // Link to the user (coach) who wrote the post
   authorName: string; // Denormalized for easier display
   tags?: string[];
   status: 'draft' | 'pending_approval' | 'published' | 'rejected';
   featuredImageUrl?: string;
   createdAt: Timestamp; // Use Firestore Timestamp for creation
   updatedAt?: Timestamp; // Use Firestore Timestamp for updates
   // dataAiHint for featured image will be part of the component, not stored directly unless needed
}

/**
 * Creates or updates a user profile in Firestore.
 * Uses the userId (Firebase Auth UID) as the document ID.
 */
export async function setUserProfile(userId: string, profileData: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    const usersCollection = collection(db, "users");
    const userDocRef = doc(usersCollection, userId);
    await setDoc(userDocRef, {
      ...profileData,
      createdAt: profileData.createdAt || serverTimestamp(), // Set on create, preserve if updating
      updatedAt: serverTimestamp() // Always update 'updatedAt'
    }, { merge: true }); // Use merge to allow partial updates and not overwrite on create
    console.log("User profile created/updated successfully for user:", userId);
  } catch (error) {
    console.error("Error creating/updating user profile:", error);
    throw error;
  }
}

/**
 * Retrieves a user profile from Firestore.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      console.log("User profile found for user:", userId);
      return { id: userDoc.id, ...userDoc.data() } as UserProfile;
    } else {
      console.log("No user profile found for user:", userId);
      return null;
    }
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
}

/**
 * Creates a new blog post in Firestore.
 */
export async function createFirestoreBlogPost(postData: Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const blogsCollection = collection(db, "blogs");
    const newPostRef = await addDoc(blogsCollection, {
      ...postData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    console.log("Blog post created successfully with ID:", newPostRef.id);
    return newPostRef.id;
  } catch (error) {
    console.error("Error creating blog post:", error);
    throw error;
  }
}

/**
 * Retrieves a single blog post from Firestore by its ID.
 */
export async function getFirestoreBlogPost(postId: string): Promise<FirestoreBlogPost | null> {
  try {
    const postDocRef = doc(db, "blogs", postId);
    const postDoc = await getDoc(postDocRef);

    if (postDoc.exists()) {
      console.log("Blog post found with ID:", postId);
      return { id: postDoc.id, ...postDoc.data() } as FirestoreBlogPost;
    } else {
      console.log("No blog post found with ID:", postId);
      return null;
    }
  } catch (error) {
    console.error("Error getting blog post:", error);
    throw error;
  }
}

/**
 * Retrieves a list of blog posts from Firestore, ordered by creation date.
 */
export async function getFirestoreBlogPosts(count = 10): Promise<FirestoreBlogPost[]> {
  try {
    const blogsCollection = collection(db, "blogs");
    const q = query(blogsCollection, orderBy("createdAt", "desc"), firestoreLimit(count));
    const querySnapshot = await getDocs(q);

    const blogPosts: FirestoreBlogPost[] = [];
    querySnapshot.forEach((doc) => {
      blogPosts.push({ id: doc.id, ...doc.data() } as FirestoreBlogPost);
    });

    console.log(`Fetched ${blogPosts.length} blog posts.`);
    return blogPosts;
  } catch (error) {
    console.error("Error getting blog posts:", error);
    throw error;
  }
}

// Add more Firestore functions as needed (e.g., updateBlogPost, deleteBlogPost, getCoaches, etc.)
