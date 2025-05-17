
// src/lib/firestore.ts
import type { Timestamp } from "firebase/firestore";
import { 
  collection, doc, setDoc, getDoc, addDoc, query, orderBy, getDocs, 
  serverTimestamp, limit as firestoreLimit, updateDoc, where, writeBatch, collectionGroup
} from "firebase/firestore";
import { db } from "./firebase";
import type { Coach, BlogPost, UserRole } from "@/types";

// Interface for User Profile data stored in Firestore
export interface FirestoreUserProfile {
  id?: string; // UID from Firebase Auth, also document ID
  name: string;
  email: string;
  bio?: string;
  role: UserRole;
  specialties?: string[]; // For coaches
  keywords?: string[]; // For coaches
  profileImageUrl?: string;
  certifications?: string[]; // For coaches
  location?: string;  // For coaches
  availability?: string; 
  rates?: string; 
  subscriptionTier?: 'free' | 'premium'; // For coaches
  websiteUrl?: string; // For coaches (premium)
  introVideoUrl?: string; // For coaches (premium)
  socialLinks?: { platform: string; url: string }[]; // For coaches (premium)
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// Interface for Blog Post data stored in Firestore
export interface FirestoreBlogPost {
   id?: string; 
   slug: string;
   title: string;
   content: string; 
   excerpt?: string;
   authorId: string; 
   authorName: string; 
   tags?: string[];
   status: 'draft' | 'pending_approval' | 'published' | 'rejected';
   featuredImageUrl?: string;
   createdAt: Timestamp; 
   updatedAt?: Timestamp; 
}

// Helper to convert Firestore Timestamps to ISO strings for a coach object
const mapCoachFromFirestore = (docData: any, id: string): Coach => {
  const data = docData as Omit<FirestoreUserProfile, 'id'>; // Type assertion
  return {
    ...data,
    id,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
    specialties: data.specialties || [],
    keywords: data.keywords || [],
    dataSource: 'Firestore', // Add debugging flag
  } as Coach;
};

// Helper to convert Firestore Timestamps to ISO strings for a blog post object
const mapBlogPostFromFirestore = (docData: any, id: string): BlogPost => {
  const data = docData as Omit<FirestoreBlogPost, 'id'>; // Type assertion
  return {
    ...data,
    id,
    createdAt: data.createdAt.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
    tags: data.tags || [],
    dataSource: 'Firestore', // Add debugging flag
  } as BlogPost;
};


export async function setUserProfile(userId: string, profileData: Partial<Omit<FirestoreUserProfile, 'id' | 'createdAt' | 'updatedAt'>>) {
  try {
    const userDocRef = doc(db, "users", userId);
    await setDoc(userDocRef, {
      ...profileData,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    
    // If it's the first time setting the profile, also set createdAt
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists() && !userSnap.data().createdAt) {
        await updateDoc(userDocRef, { createdAt: serverTimestamp() });
    }
    console.log("User profile created/updated successfully for user:", userId);
  } catch (error) {
    console.error("Error creating/updating user profile:", error);
    throw error;
  }
}

export async function getUserProfile(userId: string): Promise<FirestoreUserProfile & {id: string} | null> {
  try {
    const userDocRef = doc(db, "users", userId);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() } as FirestoreUserProfile & {id: string};
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
}

export async function createFirestoreBlogPost(postData: Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const blogsCollection = collection(db, "blogs");
    const newPostRef = await addDoc(blogsCollection, {
      ...postData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return newPostRef.id;
  } catch (error) {
    console.error("Error creating blog post:", error);
    throw error;
  }
}

export async function updateFirestoreBlogPost(postId: string, postData: Partial<Omit<FirestoreBlogPost, 'id' | 'createdAt' | 'authorId' | 'authorName'>>) {
    try {
        const postDocRef = doc(db, "blogs", postId);
        await updateDoc(postDocRef, {
            ...postData,
            updatedAt: serverTimestamp()
        });
        console.log("Blog post updated successfully:", postId);
    } catch (error) {
        console.error("Error updating blog post:", error);
        throw error;
    }
}


export async function getFirestoreBlogPost(postId: string): Promise<BlogPost | null> {
  try {
    const postDocRef = doc(db, "blogs", postId);
    const postDoc = await getDoc(postDocRef);

    if (postDoc.exists()) {
      return mapBlogPostFromFirestore(postDoc.data(), postDoc.id);
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting blog post:", error);
    throw error;
  }
}

export async function getFirestoreBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    try {
        const blogsCollection = collection(db, "blogs");
        const q = query(blogsCollection, where("slug", "==", slug), firestoreLimit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const postDoc = querySnapshot.docs[0];
            return mapBlogPostFromFirestore(postDoc.data(), postDoc.id);
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error getting blog post by slug:", error);
        throw error;
    }
}

export async function getPublishedBlogPosts(count = 10): Promise<BlogPost[]> {
  try {
    const blogsCollection = collection(db, "blogs");
    const q = query(
        blogsCollection, 
        where("status", "==", "published"), 
        orderBy("createdAt", "desc"), 
        firestoreLimit(count)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => mapBlogPostFromFirestore(doc.data(), doc.id));
  } catch (error) {
    console.error("Error getting published blog posts:", error);
    throw error;
  }
}

export async function getBlogPostsByAuthor(authorId: string, count = 10): Promise<BlogPost[]> {
    try {
        const blogsCollection = collection(db, "blogs");
        const q = query(
            blogsCollection,
            where("authorId", "==", authorId),
            orderBy("createdAt", "desc"),
            firestoreLimit(count)
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => mapBlogPostFromFirestore(doc.data(), doc.id));
    } catch (error) {
        console.error("Error getting blog posts by author:", error);
        throw error;
    }
}

export async function getAllCoaches(filters?: { searchTerm?: string }): Promise<Coach[]> {
    try {
        let coachesQuery = query(collection(db, "users"), where("role", "==", "coach"), orderBy("name", "asc"));
        // Basic search term filter - can be expanded for more specific field searches if needed.
        // Note: Firestore's querying capabilities for "contains" style search are limited.
        // For more advanced search, consider a dedicated search service like Algolia or Typesense.
        if (filters?.searchTerm) {
            const lowerSearchTerm = filters.searchTerm.toLowerCase();
            // This is a very basic client-side filter after fetching all coaches.
            // Not efficient for large datasets.
            const allCoachesSnap = await getDocs(coachesQuery);
            const allCoaches = allCoachesSnap.docs.map(doc => mapCoachFromFirestore(doc.data(), doc.id));
            return allCoaches.filter(coach => 
                coach.name.toLowerCase().includes(lowerSearchTerm) ||
                coach.bio.toLowerCase().includes(lowerSearchTerm) ||
                coach.specialties.some(s => s.toLowerCase().includes(lowerSearchTerm)) ||
                coach.keywords.some(k => k.toLowerCase().includes(lowerSearchTerm))
            );
        }

        const querySnapshot = await getDocs(coachesQuery);
        return querySnapshot.docs.map(doc => mapCoachFromFirestore(doc.data(), doc.id));
    } catch (error) {
        console.error("Error getting all coaches:", error);
        throw error;
    }
}

export async function getCoachById(coachId: string): Promise<Coach | null> {
    try {
        const coachDocRef = doc(db, "users", coachId);
        const coachDoc = await getDoc(coachDocRef);

        if (coachDoc.exists() && coachDoc.data().role === 'coach') {
            return mapCoachFromFirestore(coachDoc.data(), coachDoc.id);
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error getting coach by ID:", error);
        throw error;
    }
}


export async function getAllCoachIds(): Promise<string[]> {
    try {
        const q = query(collection(db, "users"), where("role", "==", "coach"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => doc.id);
    } catch (error) {
        console.error("Error getting all coach IDs:", error);
        throw [];
    }
}

export async function getAllPublishedBlogPostSlugs(): Promise<string[]> {
    try {
        const q = query(collection(db, "blogs"), where("status", "==", "published"));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => (doc.data() as FirestoreBlogPost).slug);
    } catch (error) {
        console.error("Error getting all published blog post slugs:", error);
        throw [];
    }
}

export async function getFeaturedCoaches(count = 3): Promise<Coach[]> {
    try {
        // For now, just get any coaches, ordered by name. True "featured" logic might be more complex.
        const q = query(collection(db, "users"), where("role", "==", "coach"), orderBy("name"), firestoreLimit(count));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => mapCoachFromFirestore(doc.data(), doc.id));
    } catch (error) {
        console.error("Error getting featured coaches:", error);
        throw [];
    }
}

export async function updateCoachSubscriptionTier(coachId: string, tier: 'free' | 'premium'): Promise<void> {
    try {
        const coachDocRef = doc(db, "users", coachId);
        await updateDoc(coachDocRef, {
            subscriptionTier: tier,
            updatedAt: serverTimestamp()
        });
        console.log(`Coach ${coachId} subscription tier updated to ${tier}`);
    } catch (error) {
        console.error("Error updating coach subscription tier:", error);
        throw error;
    }
}

export async function updateBlogPostStatus(postId: string, status: FirestoreBlogPost['status']): Promise<void> {
    try {
        const postDocRef = doc(db, "blogs", postId);
        await updateDoc(postDocRef, {
            status: status,
            updatedAt: serverTimestamp()
        });
        console.log(`Blog post ${postId} status updated to ${status}`);
    } catch (error) {
        console.error("Error updating blog post status:", error);
        throw error;
    }
}
